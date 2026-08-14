"use server";

import { randomBytes } from "crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { getPortalProfile } from "@/lib/auth";
import { can, scopedDepartment } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  currentAcademicYear,
  parseStudentForm,
  StudentActionResult,
  validateStudentForm,
} from "@/lib/validations/student";
import {
  parseStudentImportCsv,
  type StudentImportResult,
} from "@/lib/validations/student-import";
import {
  parseStaffImportCsv,
  STAFF_STATUSES,
  type StaffStatus,
  type StaffImportResult,
  type StaffImportRow,
} from "@/lib/validations/staff-import";
import { DEPARTMENTS, STAFF_ORG_UNITS } from "@/lib/constants";
import {
  getExistingStudentNumbers,
  isStudentNumberConflictMessage,
  resolveStudentNumber,
  STUDENT_NUMBERS_NETWORK_ERROR,
} from "@/lib/student-numbers";

function newQrToken(): string {
  return randomBytes(32).toString("hex");
}

function nowIso(): string {
  return new Date().toISOString();
}

function summarizeImportFailure(
  entity: "students" | "employees",
  errors: { row: number; message: string }[]
): string {
  const first = errors.find((item) => item.message)?.message;
  return first
    ? `No ${entity} were imported. ${first}`
    : `No ${entity} were imported. Review the errors and try again.`;
}

type StaffActionResult = StudentActionResult;

type StaffFormInput = {
  full_name: string;
  department: string;
  job_title: string;
  person_status: StaffStatus;
};

/** staff_assignments.status uses lowercase; people.person_status uses Title Case. */
function toAssignmentStatus(personStatus: StaffStatus): "active" | "inactive" | "archived" {
  if (personStatus === "Inactive") return "inactive";
  if (personStatus === "Archived") return "archived";
  return "active";
}

async function requirePeoplePermission(
  permission: "people.create" | "people.edit" | "people.archive" | "people.delete" | "bulk_import.execute"
): Promise<StudentActionResult | null> {
  const profile = await getPortalProfile();
  if (!profile || !can(profile, permission)) {
    return {
      success: false,
      error: "You don't have permission to manage the roster.",
    };
  }
  return null;
}

async function enforceDepartmentScope(
  department: string
): Promise<string | null> {
  const profile = await getPortalProfile();
  const scope = scopedDepartment(profile);
  if (scope && department !== scope) {
    return "You can only manage people in your assigned department.";
  }
  return null;
}

async function isPersonNumberTaken(
  personNumber: string,
  excludeId?: string
): Promise<boolean> {
  const supabase = await createClient();
  let query = supabase
    .from("people")
    .select("id")
    .eq("person_number", personNumber);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data } = await query.maybeSingle();
  return Boolean(data);
}

function nextEmployeeNumber(
  department: string,
  existingNumbers: string[],
  reservedNumbers: Set<string>
): string {
  const escapedDepartment = department.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^EMP-${escapedDepartment}-(\\d+)$`, "i");
  let max = 0;

  for (const number of [...existingNumbers, ...reservedNumbers]) {
    const match = pattern.exec(number);
    if (!match) continue;
    max = Math.max(max, Number(match[1]));
  }

  return `EMP-${department}-${String(max + 1).padStart(3, "0")}`;
}

async function getExistingEmployeeNumbers(departments: string[]) {
  if (departments.length === 0) return new Map<string, string[]>();

  const supabase = await createClient();
  const uniqueDepartments = [...new Set(departments)];
  const numbers = new Map<string, string[]>();

  for (const department of uniqueDepartments) {
    const { data } = await supabase
      .from("people")
      .select("person_number")
      .eq("person_kind", "staff")
      .like("person_number", `EMP-${department}-%`);

    numbers.set(
      department,
      (data ?? [])
        .map((row) => row.person_number)
        .filter((value): value is string => Boolean(value))
    );
  }

  return numbers;
}

async function insertStudentRecord(
  input: ReturnType<typeof parseStudentForm>
): Promise<StudentActionResult> {
  const supabase = await createClient();
  const academicYear = input.academic_year || currentAcademicYear();

  const { data: student, error: studentError } = await supabase
    .from("students")
    .insert({
      student_number: input.student_number,
      full_name: input.full_name,
      student_status: input.student_status,
      qr_token: newQrToken(),
    })
    .select("id")
    .single();

  if (studentError || !student) {
    return {
      success: false,
      error: studentError?.message ?? "Failed to create student.",
    };
  }

  const { error: academicError } = await supabase
    .from("student_academic_records")
    .insert({
      student_id: student.id,
      department: input.department,
      course: input.course,
      year_level: input.year_level,
      academic_year: academicYear,
      status: input.student_status,
      created_at: nowIso(),
      updated_at: nowIso(),
    });

  if (academicError) {
    await supabase.from("students").delete().eq("id", student.id);
    await supabase.from("people").delete().eq("id", student.id);
    return {
      success: false,
      error: academicError.message ?? "Failed to save academic record.",
    };
  }

  return { success: true };
}

async function insertStaffRecord(
  row: StaffImportRow,
  personNumber: string
): Promise<StudentActionResult> {
  const supabase = await createClient();

  const { data: person, error: personError } = await supabase
    .from("people")
    .insert({
      person_number: personNumber,
      full_name: row.full_name,
      person_kind: "staff",
      person_status: row.person_status,
      qr_token: newQrToken(),
    })
    .select("id")
    .single();

  if (personError || !person) {
    return {
      success: false,
      error: personError?.message ?? "Failed to create employee.",
    };
  }

  const { error: assignmentError } = await supabase
    .from("staff_assignments")
    .insert({
      person_id: person.id,
      department: row.department,
      job_title: row.job_title,
      status: toAssignmentStatus(row.person_status),
    });

  if (assignmentError) {
    await supabase.from("people").delete().eq("id", person.id);
    return {
      success: false,
      error: assignmentError.message ?? "Failed to save staff assignment.",
    };
  }

  return { success: true };
}

function parseStaffForm(formData: FormData): StaffFormInput {
  const status = String(formData.get("person_status") ?? "Active");
  return {
    full_name: String(formData.get("full_name") ?? "").trim(),
    department: String(formData.get("department") ?? "").trim(),
    job_title: String(formData.get("job_title") ?? "").trim(),
    person_status: (STAFF_STATUSES as readonly string[]).includes(status)
      ? (status as StaffStatus)
      : "Active",
  };
}

function validateStaffForm(input: StaffFormInput): StaffActionResult | null {
  const validDepartments = [...DEPARTMENTS, ...STAFF_ORG_UNITS] as readonly string[];

  if (!input.full_name) {
    return { success: false, error: "Full name is required." };
  }
  if (!input.department) {
    return { success: false, error: "Department is required." };
  }
  if (!validDepartments.includes(input.department)) {
    return { success: false, error: "Invalid department." };
  }
  if (!input.job_title) {
    return { success: false, error: "Job title is required." };
  }
  return null;
}

export async function createStaff(
  formData: FormData
): Promise<StaffActionResult> {
  const authError = await requirePeoplePermission("people.create");
  if (authError) return authError;

  const input = parseStaffForm(formData);
  const validationError = validateStaffForm(input);
  if (validationError) return validationError;

  const scopeError = await enforceDepartmentScope(input.department);
  if (scopeError) return { success: false, error: scopeError };

  const existingNumbers = await getExistingEmployeeNumbers([input.department]);
  const personNumber = nextEmployeeNumber(
    input.department,
    existingNumbers.get(input.department) ?? [],
    new Set<string>()
  );

  if (await isPersonNumberTaken(personNumber)) {
    return { success: false, error: "Employee number already exists." };
  }

  const result = await insertStaffRecord(
    {
      rowNumber: 0,
      full_name: input.full_name,
      department: input.department,
      job_title: input.job_title,
      person_status: input.person_status,
    },
    personNumber
  );
  if (!result.success) return result;

  revalidatePath("/students");
  revalidatePath("/dashboard");
  revalidateTag("dashboard-stats", "max");
  return { success: true };
}

export async function updateStaff(
  personId: string,
  formData: FormData
): Promise<StaffActionResult> {
  const authError = await requirePeoplePermission("people.edit");
  if (authError) return authError;

  if (!personId) {
    return { success: false, error: "Employee ID is required." };
  }

  const input = parseStaffForm(formData);
  const validationError = validateStaffForm(input);
  if (validationError) return validationError;

  const scopeError = await enforceDepartmentScope(input.department);
  if (scopeError) return { success: false, error: scopeError };

  const supabase = await createClient();
  const assignmentId = String(formData.get("assignment_id") ?? "");
  const previousDepartment = String(formData.get("previous_department") ?? "").trim();

  const { data: existing, error: existingError } = await supabase
    .from("people")
    .select("id, person_number, person_kind")
    .eq("id", personId)
    .eq("person_kind", "staff")
    .maybeSingle();

  if (existingError || !existing) {
    return { success: false, error: "Employee not found." };
  }

  let personNumber = existing.person_number;
  const departmentChanged =
    previousDepartment.length > 0 && previousDepartment !== input.department;

  if (departmentChanged) {
    const existingNumbers = await getExistingEmployeeNumbers([input.department]);
    personNumber = nextEmployeeNumber(
      input.department,
      existingNumbers.get(input.department) ?? [],
      new Set<string>()
    );

    if (await isPersonNumberTaken(personNumber, personId)) {
      return { success: false, error: "Employee number already exists." };
    }
  }

  const { error: personError } = await supabase
    .from("people")
    .update({
      person_number: personNumber,
      full_name: input.full_name,
      person_status: input.person_status,
    })
    .eq("id", personId);

  if (personError) {
    return {
      success: false,
      error: personError.message ?? "Failed to update employee.",
    };
  }

  const assignmentPayload = {
    department: input.department,
    job_title: input.job_title,
    status: toAssignmentStatus(input.person_status),
  };

  if (assignmentId) {
    const { error: assignmentError } = await supabase
      .from("staff_assignments")
      .update(assignmentPayload)
      .eq("id", assignmentId);

    if (assignmentError) {
      return {
        success: false,
        error: assignmentError.message ?? "Failed to update staff assignment.",
      };
    }
  } else {
    const { error: assignmentError } = await supabase
      .from("staff_assignments")
      .insert({
        person_id: personId,
        ...assignmentPayload,
      });

    if (assignmentError) {
      return {
        success: false,
        error: assignmentError.message ?? "Failed to create staff assignment.",
      };
    }
  }

  revalidatePath("/students");
  revalidatePath("/dashboard");
  revalidateTag("dashboard-stats", "max");
  return { success: true };
}

export async function archiveStaff(
  personId: string
): Promise<StaffActionResult> {
  const authError = await requirePeoplePermission("people.archive");
  if (authError) return authError;

  if (!personId) {
    return { success: false, error: "Employee ID is required." };
  }

  const supabase = await createClient();

  const { error: personError } = await supabase
    .from("people")
    .update({ person_status: "Archived" })
    .eq("id", personId)
    .eq("person_kind", "staff");

  if (personError) {
    return {
      success: false,
      error: personError.message ?? "Failed to archive employee.",
    };
  }

  await supabase
    .from("staff_assignments")
    .update({ status: "archived" })
    .eq("person_id", personId);

  revalidatePath("/students");
  revalidatePath("/dashboard");
  revalidateTag("dashboard-stats", "max");
  return { success: true };
}

export async function createStudent(
  formData: FormData
): Promise<StudentActionResult> {
  const authError = await requirePeoplePermission("people.create");
  if (authError) return authError;

  const input = parseStudentForm(formData);
  const validationError = validateStudentForm(input);
  if (validationError) return validationError;

  const scopeError = await enforceDepartmentScope(input.department);
  if (scopeError) return { success: false, error: scopeError };

  const academicYear = input.academic_year || currentAcademicYear();

  try {
    const existingNumbers = await getExistingStudentNumbers(academicYear);
    const reservedNumbers = new Set<string>();

    for (let attempt = 0; attempt < 100; attempt += 1) {
      input.student_number = await resolveStudentNumber(
        academicYear,
        existingNumbers,
        reservedNumbers,
        input.student_number
      );

      const result = await insertStudentRecord(input);
      if (result.success) {
        revalidatePath("/students");
        revalidatePath("/dashboard");
        revalidateTag("dashboard-stats", "max");
        return { success: true };
      }

      if (!isStudentNumberConflictMessage(result.error)) {
        return result;
      }

      reservedNumbers.add(input.student_number);
      if (!existingNumbers.includes(input.student_number)) {
        existingNumbers.push(input.student_number);
      }
      input.student_number = "";
    }

    return {
      success: false,
      error: "Unable to allocate a unique student number.",
    };
  } catch (error) {
    console.error("createStudent failed:", error);
    return {
      success: false,
      error:
        error instanceof Error &&
        (error.message === STUDENT_NUMBERS_NETWORK_ERROR ||
          error.message.toLowerCase().includes("fetch failed"))
          ? STUDENT_NUMBERS_NETWORK_ERROR
          : error instanceof Error
            ? error.message
            : "Failed to create student.",
    };
  }
}

export async function updateStudent(
  studentId: string,
  formData: FormData
): Promise<StudentActionResult> {
  const authError = await requirePeoplePermission("people.edit");
  if (authError) return authError;

  if (!studentId) {
    return { success: false, error: "Student ID is required." };
  }

  const input = parseStudentForm(formData);
  const validationError = validateStudentForm(input);
  if (validationError) return validationError;

  const scopeError = await enforceDepartmentScope(input.department);
  if (scopeError) return { success: false, error: scopeError };

  const supabase = await createClient();
  const academicYear = input.academic_year || currentAcademicYear();
  const academicRecordId = String(formData.get("academic_record_id") ?? "");

  // Keep the existing auto-formatted student number; never rewrite on edit.
  const { error: studentError } = await supabase
    .from("students")
    .update({
      full_name: input.full_name,
      student_status: input.student_status,
    })
    .eq("id", studentId);

  if (studentError) {
    return {
      success: false,
      error: studentError.message ?? "Failed to update student.",
    };
  }

  const academicPayload = {
    department: input.department,
    course: input.course,
    year_level: input.year_level,
    academic_year: academicYear,
    status: input.student_status,
  };

  if (academicRecordId) {
    const { error: academicError } = await supabase
      .from("student_academic_records")
      .update(academicPayload)
      .eq("id", academicRecordId);

    if (academicError) {
      return {
        success: false,
        error: academicError.message ?? "Failed to update academic record.",
      };
    }
  } else {
    const { error: academicError } = await supabase
      .from("student_academic_records")
      .insert({
        student_id: studentId,
        ...academicPayload,
        created_at: nowIso(),
        updated_at: nowIso(),
      });

    if (academicError) {
      return {
        success: false,
        error: academicError.message ?? "Failed to create academic record.",
      };
    }
  }

  revalidatePath("/students");
  revalidatePath("/dashboard");
  revalidateTag("dashboard-stats", "max");
  return { success: true };
}

export async function archiveStudent(
  studentId: string
): Promise<StudentActionResult> {
  const authError = await requirePeoplePermission("people.archive");
  if (authError) return authError;

  if (!studentId) {
    return { success: false, error: "Student ID is required." };
  }

  const supabase = await createClient();

  const { error: studentError } = await supabase
    .from("students")
    .update({ student_status: "Archived" })
    .eq("id", studentId);

  if (studentError) {
    return {
      success: false,
      error: studentError.message ?? "Failed to archive student.",
    };
  }

  await supabase
    .from("student_academic_records")
    .update({ status: "Archived" })
    .eq("student_id", studentId);

  revalidatePath("/students");
  revalidatePath("/dashboard");
  revalidateTag("dashboard-stats", "max");
  return { success: true };
}

export async function importStudentsFromCsv(
  csvText: string
): Promise<StudentImportResult> {
  try {
    const profile = await getPortalProfile();
    if (
      !profile ||
      (!can(profile, "bulk_import.execute") && !can(profile, "people.create"))
    ) {
      return {
        success: false,
        error: "You don't have permission to import people.",
      };
    }

    const scope = scopedDepartment(profile);
    const preview = parseStudentImportCsv(csvText);
    if (preview.rows.length === 0) {
      return {
        success: false,
        error:
          preview.errors[0]?.message ?? "No valid student rows found in CSV.",
      };
    }

    let imported = 0;
    let skipped = 0;
    const errors = [...preview.errors];
    const reservedStudentNumbers = new Set<string>();
    const existingStudentNumbers = new Map<string, string[]>();

    for (const row of preview.rows) {
      if (scope && row.department !== scope) {
        skipped += 1;
        errors.push({
          row: row.rowNumber,
          message: `Department ${row.department} is outside your scope (${scope}).`,
        });
        continue;
      }

      const academicYear = row.academic_year || currentAcademicYear();
      if (!existingStudentNumbers.has(academicYear)) {
        existingStudentNumbers.set(
          academicYear,
          await getExistingStudentNumbers(academicYear)
        );
      }

      const preferredNumber = row.student_number;
      let studentNumber = await resolveStudentNumber(
        academicYear,
        existingStudentNumbers.get(academicYear) ?? [],
        reservedStudentNumbers,
        row.student_number
      );

      if (preferredNumber && preferredNumber !== studentNumber) {
        errors.push({
          row: row.rowNumber,
          message: `Student number ${preferredNumber} was already taken; assigned ${studentNumber} instead.`,
        });
      }

      let result = await insertStudentRecord({
        student_number: studentNumber,
        full_name: row.full_name,
        student_status: row.student_status,
        department: row.department,
        course: row.course,
        year_level: row.year_level,
        academic_year: row.academic_year,
      });

      for (let attempt = 0; attempt < 100 && !result.success; attempt += 1) {
        if (!isStudentNumberConflictMessage(result.error)) {
          break;
        }

        const conflictNumber = studentNumber;
        reservedStudentNumbers.add(conflictNumber);
        const yearNumbers = existingStudentNumbers.get(academicYear) ?? [];
        if (!yearNumbers.includes(conflictNumber)) {
          yearNumbers.push(conflictNumber);
          existingStudentNumbers.set(academicYear, yearNumbers);
        }

        studentNumber = await resolveStudentNumber(
          academicYear,
          yearNumbers,
          reservedStudentNumbers
        );

        errors.push({
          row: row.rowNumber,
          message: `Student number ${conflictNumber} was already taken; retrying with ${studentNumber}.`,
        });

        result = await insertStudentRecord({
          student_number: studentNumber,
          full_name: row.full_name,
          student_status: row.student_status,
          department: row.department,
          course: row.course,
          year_level: row.year_level,
          academic_year: row.academic_year,
        });
      }

      row.student_number = studentNumber;

      if (!result.success) {
        skipped += 1;
        errors.push({
          row: row.rowNumber,
          message: result.error,
        });
        continue;
      }

      imported += 1;
      reservedStudentNumbers.add(studentNumber);
    }

    if (imported === 0) {
      return {
        success: false,
        error: summarizeImportFailure("students", errors),
      };
    }

    revalidatePath("/students");
    revalidatePath("/dashboard");
    revalidateTag("dashboard-stats", "max");

    return {
      success: true,
      imported,
      skipped,
      errors,
    };
  } catch (error) {
    console.error("importStudentsFromCsv failed:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Student import failed due to a server error.",
    };
  }
}

export async function importStaffFromCsv(
  csvText: string
): Promise<StaffImportResult> {
  const profile = await getPortalProfile();
  if (
    !profile ||
    (!can(profile, "bulk_import.execute") && !can(profile, "people.create"))
  ) {
    return {
      success: false,
      error: "You don't have permission to import people.",
    };
  }

  const scope = scopedDepartment(profile);
  const preview = parseStaffImportCsv(csvText);
  if (preview.rows.length === 0) {
    return {
      success: false,
      error:
        preview.errors[0]?.message ?? "No valid employee rows found in CSV.",
    };
  }

  let imported = 0;
  let skipped = 0;
  const errors = [...preview.errors];
  const existingNumbers = await getExistingEmployeeNumbers(
    preview.rows.map((row) => row.department)
  );
  const reservedNumbers = new Set<string>();

  for (const row of preview.rows) {
    if (scope && row.department !== scope) {
      skipped += 1;
      errors.push({
        row: row.rowNumber,
        message: `Department ${row.department} is outside your scope (${scope}).`,
      });
      continue;
    }

    const personNumber = nextEmployeeNumber(
      row.department,
      existingNumbers.get(row.department) ?? [],
      reservedNumbers
    );

    if (await isPersonNumberTaken(personNumber)) {
      skipped += 1;
      errors.push({
        row: row.rowNumber,
        message: `Employee number ${personNumber} already exists.`,
      });
      continue;
    }

    const result = await insertStaffRecord(row, personNumber);
    if (!result.success) {
      skipped += 1;
      errors.push({
        row: row.rowNumber,
        message: result.error,
      });
      continue;
    }

    reservedNumbers.add(personNumber);
    imported += 1;
  }

  if (imported === 0) {
    return {
      success: false,
      error: summarizeImportFailure("employees", errors),
    };
  }

  revalidatePath("/students");
  revalidatePath("/dashboard");
  revalidateTag("dashboard-stats", "max");

  return {
    success: true,
    imported,
    skipped,
    errors,
  };
}
