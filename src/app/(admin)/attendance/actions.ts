"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/admin/audit";
import { getPortalProfile } from "@/lib/auth";
import { can, scopedDepartment } from "@/lib/permissions";
import { getSessionAttendanceRoster } from "@/lib/data/session-attendance";
import { getSessions } from "@/lib/data/sessions";
import { matchesAttendanceStatusFilter } from "@/lib/attendance";
import {
  buildAttendanceExportFilename,
  buildAttendanceReportCsv,
  buildAttendanceSummaryCsv,
  normalizeSummaryStatusColumns,
  type AttendanceExportMode,
  type SummaryStatusColumn,
} from "@/lib/export-attendance";
import type { AttendanceReportRow, SessionWithStats } from "@/lib/attendeaseTypes";
import { ATTENDANCE_STATUSES, type AttendanceStatus } from "@/lib/attendeaseTypes";
import { createClient } from "@/lib/supabase/server";

export type AttendanceActionResult =
  | { success: true }
  | { success: false; error: string };

export type AttendanceExportResult =
  | { success: true; csv: string; filename: string }
  | { success: false; error: string };

export async function listRecentSessions(
  limit = 40
): Promise<SessionWithStats[]> {
  const profile = await getPortalProfile();
  if (!profile || !can(profile, "attendance.view")) {
    return [];
  }

  const sessions = await getSessions(limit);
  const scope = scopedDepartment(profile);
  if (!scope) return sessions;
  return sessions.filter((session) => session.department === scope);
}

export async function updateAttendanceLog(
  logId: string,
  input: {
    scanned_at?: string | null;
    time_out_at?: string | null;
    attendance_status?: AttendanceStatus;
  }
): Promise<AttendanceActionResult> {
  const profile = await getPortalProfile();
  if (!profile || !can(profile, "attendance.edit")) {
    return {
      success: false,
      error: "You don't have permission to edit attendance.",
    };
  }

  if (!logId || logId.startsWith("absent-")) {
    return {
      success: false,
      error: "Cannot edit a row with no attendance log. Create a scan first.",
    };
  }

  if (
    input.attendance_status !== undefined &&
    !(ATTENDANCE_STATUSES as readonly string[]).includes(input.attendance_status)
  ) {
    return { success: false, error: "Invalid attendance status." };
  }

  const supabase = await createClient();
  const { data: existing, error: loadError } = await supabase
    .from("attendance_logs")
    .select("id, session_id, student_id, scanned_at, time_out_at, attendance_status")
    .eq("id", logId)
    .maybeSingle();

  if (loadError || !existing) {
    return {
      success: false,
      error: loadError?.message ?? "Attendance log not found.",
    };
  }

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    device_id: null,
  };
  if (input.scanned_at !== undefined) payload.scanned_at = input.scanned_at;
  if (input.time_out_at !== undefined) payload.time_out_at = input.time_out_at;
  if (input.attendance_status !== undefined) {
    payload.attendance_status = input.attendance_status;
  }

  if (input.scanned_at === null) {
    return {
      success: false,
      error: "Time in is required for attendance logs.",
    };
  }

  const { error } = await supabase
    .from("attendance_logs")
    .update(payload)
    .eq("id", logId);

  if (error) {
    return { success: false, error: error.message };
  }

  await writeAuditLog(profile, {
    action: "attendance.edit",
    targetType: "attendance_log",
    targetId: logId,
    metadata: {
      before: existing,
      after: input,
      session_id: existing.session_id,
      student_id: existing.student_id,
    },
  });

  revalidatePath("/attendance");
  revalidatePath("/sessions");
  revalidatePath("/reports");
  return { success: true };
}

export async function voidAttendanceLog(
  logId: string
): Promise<AttendanceActionResult> {
  const profile = await getPortalProfile();
  if (!profile || !can(profile, "attendance.void")) {
    return {
      success: false,
      error: "You don't have permission to void attendance.",
    };
  }

  if (!logId || logId.startsWith("absent-")) {
    return { success: false, error: "No attendance log to void." };
  }

  const supabase = await createClient();
  const { data: existing, error: loadError } = await supabase
    .from("attendance_logs")
    .select("id, session_id, student_id, scanned_at, time_out_at, attendance_status")
    .eq("id", logId)
    .maybeSingle();

  if (loadError || !existing) {
    return {
      success: false,
      error: loadError?.message ?? "Attendance log not found.",
    };
  }

  const { error } = await supabase
    .from("attendance_logs")
    .update({
      attendance_status: "Absent",
      time_out_at: null,
      device_id: "__voided__",
      updated_at: new Date().toISOString(),
    })
    .eq("id", logId);

  if (error) {
    return { success: false, error: error.message };
  }

  await writeAuditLog(profile, {
    action: "attendance.void",
    targetType: "attendance_log",
    targetId: logId,
    metadata: {
      before: existing,
      session_id: existing.session_id,
      student_id: existing.student_id,
    },
  });

  revalidatePath("/attendance");
  revalidatePath("/sessions");
  revalidatePath("/reports");
  return { success: true };
}

export async function exportSessionAttendanceCsv(
  sessionId: string,
  statusFilter: string = "all",
  exportMode: AttendanceExportMode = "detailed",
  summaryColumns?: SummaryStatusColumn[]
): Promise<AttendanceExportResult> {
  const profile = await getPortalProfile();
  if (!profile || !can(profile, "attendance.export")) {
    return {
      success: false,
      error: "You don't have permission to export attendance.",
    };
  }

  if (!sessionId) {
    return { success: false, error: "Session ID is required." };
  }

  const mode: AttendanceExportMode =
    exportMode === "summary" ? "summary" : "detailed";
  const columns = normalizeSummaryStatusColumns(summaryColumns);

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("attendance_sessions")
    .select("id, title, date, department, main_sessions(name)")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) {
    return { success: false, error: "Session not found." };
  }

  const scope = scopedDepartment(profile);
  if (scope && session.department !== scope) {
    return {
      success: false,
      error: "You can only export attendance for your department.",
    };
  }

  const rows = await getSessionAttendanceRoster(sessionId);
  const filteredRows =
    statusFilter && statusFilter !== "all"
      ? rows.filter((row) => matchesAttendanceStatusFilter(row, statusFilter))
      : rows;

  const reportRows: AttendanceReportRow[] = filteredRows.map((row) => ({
    id: row.id,
    session_id: sessionId,
    student_number: row.student_number,
    student_name: row.student_name,
    department: row.department,
    date: session.date,
    session_title: session.title,
    year_level: row.year_level,
    time_in: row.time_in,
    time_out: row.time_out,
    scan_by: row.scan_by,
    attendance_status: row.attendance_status,
  }));

  const mainJoined = session.main_sessions as
    | { name: string }
    | { name: string }[]
    | null
    | undefined;
  const mainSessionName = Array.isArray(mainJoined)
    ? (mainJoined[0]?.name ?? null)
    : (mainJoined?.name ?? null);

  await writeAuditLog(profile, {
    action: "attendance.export",
    targetType: "attendance_session",
    targetId: sessionId,
    department: session.department,
    metadata: {
      count: reportRows.length,
      statusFilter,
      exportMode: mode,
      summaryColumns: mode === "summary" ? columns : undefined,
    },
  });

  const csv =
    mode === "summary"
      ? buildAttendanceSummaryCsv(reportRows, {
          includeTotalSessions: false,
          summaryColumns: columns,
        })
      : buildAttendanceReportCsv(reportRows);

  return {
    success: true,
    csv,
    filename: buildAttendanceExportFilename({
      mainSessionName,
      sessionTitle: session.title,
      date: session.date,
      statusFilter,
      exportMode: mode,
    }),
  };
}

export async function exportMainSessionAttendanceCsv(
  mainSessionId: string,
  exportMode: AttendanceExportMode = "detailed",
  summaryColumns?: SummaryStatusColumn[]
): Promise<AttendanceExportResult> {
  const profile = await getPortalProfile();
  if (!profile || !can(profile, "attendance.export")) {
    return {
      success: false,
      error: "You don't have permission to export attendance.",
    };
  }

  if (!mainSessionId) {
    return { success: false, error: "Main session ID is required." };
  }

  const mode: AttendanceExportMode =
    exportMode === "summary" ? "summary" : "detailed";
  const columns = normalizeSummaryStatusColumns(summaryColumns);

  const supabase = await createClient();
  const { data: main } = await supabase
    .from("main_sessions")
    .select("id, name, department")
    .eq("id", mainSessionId)
    .maybeSingle();

  if (!main) {
    return { success: false, error: "Main session not found." };
  }

  const scope = scopedDepartment(profile);
  if (scope && main.department !== scope) {
    return {
      success: false,
      error: "You can only export attendance for your department.",
    };
  }

  const { data: subSessions, error: subError } = await supabase
    .from("attendance_sessions")
    .select("id, title, date, department")
    .eq("main_session_id", mainSessionId)
    .in("status", ["Open", "Closed", "Archived"])
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });

  if (subError) {
    return {
      success: false,
      error: subError.message ?? "Failed to load sub-sessions.",
    };
  }

  if (!subSessions?.length) {
    return {
      success: false,
      error: "This main session has no sub-sessions to export.",
    };
  }

  const reportRows: AttendanceReportRow[] = [];
  for (const session of subSessions) {
    if (scope && session.department !== scope) continue;
    const roster = await getSessionAttendanceRoster(session.id);
    for (const row of roster) {
      reportRows.push({
        id: `${session.id}-${row.student_id}`,
        session_id: session.id,
        student_number: row.student_number,
        student_name: row.student_name,
        department: row.department ?? session.department,
        date: session.date,
        session_title: session.title,
        year_level: row.year_level,
        time_in: row.time_in,
        time_out: row.time_out,
        scan_by: row.scan_by,
        attendance_status: row.attendance_status,
      });
    }
  }

  const dates = subSessions.map((session) => session.date).filter(Boolean);
  const dateLabel =
    dates.length === 0
      ? "undated"
      : dates[0] === dates[dates.length - 1]
        ? dates[0]
        : `${dates[0]}_to_${dates[dates.length - 1]}`;

  await writeAuditLog(profile, {
    action: "attendance.export",
    targetType: "main_session",
    targetId: mainSessionId,
    department: main.department,
    metadata: {
      count: reportRows.length,
      subSessionCount: subSessions.length,
      exportMode: mode,
      summaryColumns: mode === "summary" ? columns : undefined,
    },
  });

  const includeTotalSessions = subSessions.length > 1;
  const csv =
    mode === "summary"
      ? buildAttendanceSummaryCsv(reportRows, {
          includeTotalSessions,
          summaryColumns: columns,
        })
      : buildAttendanceReportCsv(reportRows);

  return {
    success: true,
    csv,
    filename: buildAttendanceExportFilename({
      mainSessionName: main.name,
      sessionTitle: "all-sub-sessions",
      date: dateLabel,
      statusFilter: "all",
      exportMode: mode,
    }),
  };
}
