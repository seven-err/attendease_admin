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
import { importStudentsFromCsv } from "@/app/(admin)/students/actions";

export type ValidateImportResult =
  | { success: true; preview: StudentImportPreview; scopedDepartment: string | null }
  | { success: false; error: string };

export async function validateBulkImportCsv(
  csvText: string
): Promise<ValidateImportResult> {
  const profile = await getPortalProfile();
  if (!profile || !can(profile, "bulk_import.view")) {
    return {
      success: false,
      error: "You don't have permission to use bulk import.",
    };
  }

  const scope = scopedDepartment(profile);
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
  csvText: string
): Promise<StudentImportResult> {
  const profile = await getPortalProfile();
  if (!profile || !can(profile, "bulk_import.execute")) {
    return {
      success: false,
      error: "You don't have permission to execute bulk import.",
    };
  }

  const validation = await validateBulkImportCsv(csvText);
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

  // Rebuild CSV of only validated in-scope rows for the shared importer.
  const header =
    "student_number,full_name,department,course,year_level,student_status";
  const lines = validation.preview.rows.map((row) =>
    [
      row.student_number,
      row.full_name,
      row.department,
      row.course,
      row.year_level,
      row.student_status,
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(",")
  );
  const scopedCsv = [header, ...lines].join("\n");

  const result = await importStudentsFromCsv(scopedCsv);
  if (!result.success) {
    return result;
  }

  await writeAuditLog(profile, {
    action: "bulk_import.execute",
    targetType: "students",
    department: validation.scopedDepartment,
    metadata: {
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
