"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/admin/audit";
import { getPortalProfile } from "@/lib/auth";
import { can, scopedDepartment } from "@/lib/permissions";
import {
  getStudentsPaginated,
  type StudentsQueryParams,
} from "@/lib/data/students";
import { createClient } from "@/lib/supabase/server";

export type QrActionResult =
  | { success: true; generated?: number; token?: string }
  | { success: false; error: string };

export type QrExportResult =
  | { success: true; csv: string; filename: string }
  | { success: false; error: string };

function newQrToken(): string {
  return randomBytes(32).toString("hex");
}

function isMissingToken(token: string | null | undefined): boolean {
  return !token?.trim();
}

async function dualWriteQrToken(
  studentId: string,
  token: string
): Promise<string | null> {
  const supabase = await createClient();

  const { error: studentError } = await supabase
    .from("students")
    .update({ qr_token: token })
    .eq("id", studentId);

  if (studentError) {
    return studentError.message ?? "Failed to update student QR token.";
  }

  const { error: peopleError } = await supabase
    .from("people")
    .update({ qr_token: token })
    .eq("id", studentId);

  if (peopleError) {
    console.error("people.qr_token dual-write failed:", peopleError.message);
  }

  return null;
}

export async function generateMissingQrTokens(): Promise<QrActionResult> {
  const profile = await getPortalProfile();
  if (!profile || !can(profile, "qr.generate")) {
    return {
      success: false,
      error: "You don't have permission to generate QR tokens.",
    };
  }

  const supabase = await createClient();
  const scope = scopedDepartment(profile);

  let query = supabase
    .from("students")
    .select("id, student_number, full_name, qr_token")
    .eq("qr_token", "");

  if (scope) {
    const { data: scopedIds } = await supabase
      .from("student_academic_records")
      .select("student_id")
      .eq("department", scope);
    const ids = [...new Set((scopedIds ?? []).map((r) => r.student_id))];
    if (ids.length === 0) {
      return { success: true, generated: 0 };
    }
    query = query.in("id", ids);
  }

  const { data: students, error } = await query.limit(500);
  if (error) {
    return { success: false, error: error.message };
  }

  // Also include null tokens if any slipped past the empty-string filter.
  const missing = (students ?? []).filter((s) => isMissingToken(s.qr_token));
  let generated = 0;

  for (const student of missing) {
    const token = newQrToken();
    const writeError = await dualWriteQrToken(student.id, token);
    if (writeError) continue;

    await writeAuditLog(profile, {
      action: "qr.generate",
      targetType: "student",
      targetId: student.id,
      department: scope,
      metadata: {
        student_number: student.student_number,
        full_name: student.full_name,
      },
    });
    generated += 1;
  }

  revalidatePath("/qr");
  revalidatePath("/students");
  return { success: true, generated };
}

export async function regenerateQrToken(
  studentId: string
): Promise<QrActionResult> {
  const profile = await getPortalProfile();
  if (!profile) {
    return { success: false, error: "Unauthorized." };
  }

  if (!studentId) {
    return { success: false, error: "Student ID is required." };
  }

  const supabase = await createClient();
  const { data: student, error } = await supabase
    .from("students")
    .select(
      "id, student_number, full_name, qr_token, student_academic_records(department)"
    )
    .eq("id", studentId)
    .maybeSingle();

  if (error || !student) {
    return { success: false, error: error?.message ?? "Student not found." };
  }

  const scope = scopedDepartment(profile);
  if (scope) {
    const records = Array.isArray(student.student_academic_records)
      ? student.student_academic_records
      : student.student_academic_records
        ? [student.student_academic_records]
        : [];
    const inScope = records.some(
      (r: { department?: string }) => r.department === scope
    );
    if (!inScope) {
      return {
        success: false,
        error: "You can only manage QR tokens in your assigned department.",
      };
    }
  }

  const hadToken = !isMissingToken(student.qr_token);
  const permissionNeeded = hadToken ? "qr.regenerate" : "qr.generate";
  if (!can(profile, permissionNeeded)) {
    return {
      success: false,
      error: `You don't have permission to ${hadToken ? "regenerate" : "generate"} QR tokens.`,
    };
  }

  const token = newQrToken();
  const writeError = await dualWriteQrToken(studentId, token);
  if (writeError) {
    return { success: false, error: writeError };
  }

  await writeAuditLog(profile, {
    action: hadToken ? "qr.regenerate" : "qr.generate",
    targetType: "student",
    targetId: studentId,
    department: scope,
    metadata: {
      student_number: student.student_number,
      full_name: student.full_name,
    },
  });

  revalidatePath("/qr");
  revalidatePath("/students");
  return { success: true, token };
}

export async function exportQrCsv(
  params: StudentsQueryParams
): Promise<QrExportResult> {
  const profile = await getPortalProfile();
  if (!profile || !can(profile, "qr.export")) {
    return {
      success: false,
      error: "You don't have permission to export QR tokens.",
    };
  }

  const scope = scopedDepartment(profile);
  const query: StudentsQueryParams = {
    ...params,
    page: 1,
    pageSize: 50,
    department:
      scope ??
      (params.department && params.department !== "all"
        ? params.department
        : "all"),
  };

  const rows: {
    student_number: string;
    full_name: string;
    department: string | null;
    qr_token: string;
  }[] = [];

  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const result = await getStudentsPaginated({ ...query, page });
    totalPages = result.totalPages;
    for (const student of result.items) {
      rows.push({
        student_number: student.student_number,
        full_name: student.full_name,
        department: student.department,
        qr_token: student.qr_token,
      });
    }
    page += 1;
    if (page > 40) break;
  }

  const header = ["student_number", "full_name", "department", "qr_token"];
  const escape = (value: string | null | undefined) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [
    header.join(","),
    ...rows.map((row) =>
      [
        escape(row.student_number),
        escape(row.full_name),
        escape(row.department),
        escape(row.qr_token),
      ].join(",")
    ),
  ].join("\n");

  await writeAuditLog(profile, {
    action: "qr.export",
    targetType: "students",
    department: scope,
    metadata: { count: rows.length, filters: params },
  });

  return {
    success: true,
    csv,
    filename: `qr-tokens-${new Date().toISOString().slice(0, 10)}.csv`,
  };
}
