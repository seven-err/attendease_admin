"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getAdminProfile } from "@/lib/auth";
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

async function requireAdmin(): Promise<StudentActionResult | null> {
  const profile = await getAdminProfile();
  if (!profile) {
    return { success: false, error: "Unauthorized. Admin access required." };
  }
  return null;
}

async function isStudentNumberTaken(
  studentNumber: string,
  excludeId?: string
): Promise<boolean> {
  const supabase = await createClient();
  let query = supabase
    .from("students")
    .select("id")
    .eq("student_number", studentNumber);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data } = await query.maybeSingle();
  return Boolean(data);
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
    });

  if (academicError) {
    await supabase.from("students").delete().eq("id", student.id);
    return {
      success: false,
      error: academicError.message ?? "Failed to save academic record.",
    };
  }

  return { success: true };
}

export async function createStudent(
  formData: FormData
): Promise<StudentActionResult> {
  const authError = await requireAdmin();
  if (authError) return authError;

  const input = parseStudentForm(formData);
  const validationError = validateStudentForm(input);
  if (validationError) return validationError;

  if (await isStudentNumberTaken(input.student_number)) {
    return { success: false, error: "Student number already exists." };
  }

  const result = await insertStudentRecord(input);
  if (!result.success) {
    return result;
  }

  revalidatePath("/students");
  revalidatePath("/dashboard");
  revalidateTag("dashboard-stats", "max");
  return { success: true };
}

export async function updateStudent(
  studentId: string,
  formData: FormData
): Promise<StudentActionResult> {
  const authError = await requireAdmin();
  if (authError) return authError;

  if (!studentId) {
    return { success: false, error: "Student ID is required." };
  }

  const input = parseStudentForm(formData);
  const validationError = validateStudentForm(input);
  if (validationError) return validationError;

  if (await isStudentNumberTaken(input.student_number, studentId)) {
    return { success: false, error: "Student number already exists." };
  }

  const supabase = await createClient();
  const academicYear = input.academic_year || currentAcademicYear();
  const academicRecordId = String(formData.get("academic_record_id") ?? "");

  const { error: studentError } = await supabase
    .from("students")
    .update({
      student_number: input.student_number,
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
  const authError = await requireAdmin();
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
  const authError = await requireAdmin();
  if (authError && !authError.success) {
    return { success: false, error: authError.error };
  }

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

  for (const row of preview.rows) {
    if (await isStudentNumberTaken(row.student_number)) {
      skipped += 1;
      errors.push({
        row: row.rowNumber,
        message: `Student number ${row.student_number} already exists.`,
      });
      continue;
    }

    const result = await insertStudentRecord({
      student_number: row.student_number,
      full_name: row.full_name,
      student_status: row.student_status,
      department: row.department,
      course: row.course,
      year_level: row.year_level,
      academic_year: row.academic_year,
    });

    if (!result.success) {
      skipped += 1;
      errors.push({
        row: row.rowNumber,
        message: result.error,
      });
      continue;
    }

    imported += 1;
  }

  if (imported === 0) {
    return {
      success: false,
      error: "No students were imported. Review the errors and try again.",
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
