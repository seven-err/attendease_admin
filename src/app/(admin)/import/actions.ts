"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { writeAuditLog } from "@/lib/admin/audit";
import { getPortalProfile } from "@/lib/auth";
import { can, scopedDepartment } from "@/lib/permissions";
import {
  parseStudentImportCsv,
  type StudentImportPreview,
  type StudentImportResult,
} from "@/lib/validations/student-import";
import {
  parseStaffImportCsv,
  type StaffImportPreview,
} from "@/lib/validations/staff-import";
import {
  importStaffFromCsv,
  importStudentsFromCsv,
} from "@/app/(admin)/students/actions";

export type ImportKind = "students" | "employees";

export type ValidateImportResult =
  | {
      success: true;
      preview: StudentImportPreview | StaffImportPreview;
      scopedDepartment: string | null;
    }
  | { success: false; error: string };

export async function validateBulkImportCsv(
  csvText: string,
  importKind: ImportKind = "students"
): Promise<ValidateImportResult> {
  const profile = await getPortalProfile();
  if (!profile || !can(profile, "bulk_import.view")) {
    return {
      success: false,
      error: "You don't have permission to use bulk import.",
    };
  }

  const scope = scopedDepartment(profile);
  if (importKind === "employees") {
    const preview = parseStaffImportCsv(csvText);

    if (scope) {
      const inScopeRows = [];
      const errors = [...preview.errors];

      for (const row of preview.rows) {
        if (row.department !== scope) {
          errors.push({
            row: row.rowNumber,
            message: `Department ${row.department} is outside your scope (${scope}).`,
          });
          continue;
        }
        inScopeRows.push(row);
      }

      return {
        success: true,
        preview: { rows: inScopeRows, errors },
        scopedDepartment: scope,
      };
    }

    return {
      success: true,
      preview,
      scopedDepartment: null,
    };
  }

  const preview = parseStudentImportCsv(csvText);

  if (scope) {
    const inScopeRows = [];
    const errors = [...preview.errors];

    for (const row of preview.rows) {
      if (row.department !== scope) {
        errors.push({
          row: row.rowNumber,
          message: `Department ${row.department} is outside your scope (${scope}).`,
        });
        continue;
      }
      inScopeRows.push(row);
    }

    return {
      success: true,
      preview: { rows: inScopeRows, errors },
      scopedDepartment: scope,
    };
  }

  return {
    success: true,
    preview,
    scopedDepartment: null,
  };
}

export async function executeBulkImport(
  csvText: string,
  importKind: ImportKind = "students"
): Promise<StudentImportResult> {
  const profile = await getPortalProfile();
  if (!profile || !can(profile, "bulk_import.execute")) {
    return {
      success: false,
      error: "You don't have permission to execute bulk import.",
    };
  }

  const validation = await validateBulkImportCsv(csvText, importKind);
  if (!validation.success) {
    return { success: false, error: validation.error };
  }

  if (validation.preview.rows.length === 0) {
    return {
      success: false,
      error:
        validation.preview.errors[0]?.message ??
        "No valid in-scope rows to import.",
    };
  }

  const quoteCell = (cell: unknown) =>
    `"${String(cell).replace(/"/g, '""')}"`;
  const scopedCsv =
    importKind === "employees"
      ? [
          "full_name,department,job_title,person_status",
          ...validation.preview.rows.map((row) =>
            [
              row.full_name,
              row.department,
              "job_title" in row ? row.job_title : "",
              "person_status" in row ? row.person_status : "Active",
            ]
              .map(quoteCell)
              .join(",")
          ),
        ].join("\n")
      : [
          "student_number,full_name,department,course,year_level,student_status",
          ...validation.preview.rows.map((row) =>
            [
              "student_number" in row ? row.student_number : "",
              row.full_name,
              row.department,
              "course" in row ? row.course : "",
              "year_level" in row ? row.year_level : "",
              "student_status" in row ? row.student_status : "Active",
            ]
              .map(quoteCell)
              .join(",")
          ),
        ].join("\n");

  const result =
    importKind === "employees"
      ? await importStaffFromCsv(scopedCsv)
      : await importStudentsFromCsv(scopedCsv);
  if (!result.success) {
    return result;
  }

  await writeAuditLog(profile, {
    action: "bulk_import.execute",
    targetType: importKind,
    department: validation.scopedDepartment,
    metadata: {
      import_kind: importKind,
      imported: result.imported,
      skipped: result.skipped,
      error_count: result.errors.length,
    },
  });

  revalidatePath("/import");
  revalidatePath("/students");
  revalidatePath("/dashboard");
  revalidateTag("dashboard-stats", "max");

  return result;
}
