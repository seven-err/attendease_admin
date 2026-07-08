import { resolveAttendanceStatus } from "@/lib/attendance";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import {
  emptyLogCounts,
  SessionLogCountsMap,
} from "@/lib/data/session-stats";

type LogCountRow = {
  session_id: string;
  present_count: number;
  late_count: number;
  absent_count: number;
};

type AttendanceLogStatusRow = {
  session_id: string;
  scanned_at: string;
  time_out_at: string | null;
  attendance_status: string;
};

function buildLogCountsFromRows(
  rows: AttendanceLogStatusRow[]
): SessionLogCountsMap {
  const logCounts: SessionLogCountsMap = new Map();

  for (const log of rows) {
    const counts = logCounts.get(log.session_id) ?? emptyLogCounts();
    const status = resolveAttendanceStatus(
      log.scanned_at,
      log.time_out_at,
      log.attendance_status
    );
    if (status === "Present") counts.present++;
    else if (status === "Late" || status === "On Time") counts.late++;
    else if (status === "Absent") counts.absent++;
    logCounts.set(log.session_id, counts);
  }

  return logCounts;
}

export async function getSessionLogCounts(
  supabase: SupabaseServerClient,
  sessionIds: string[]
): Promise<SessionLogCountsMap> {
  if (!sessionIds.length) return new Map();

  const { data, error } = await supabase.rpc("get_session_log_counts", {
    p_session_ids: sessionIds,
  });

  if (!error && data?.length) {
    const logCounts: SessionLogCountsMap = new Map();
    for (const row of data as LogCountRow[]) {
      logCounts.set(row.session_id, {
        present: Number(row.present_count ?? 0),
        late: Number(row.late_count ?? 0),
        absent: Number(row.absent_count ?? 0),
      });
    }
    return logCounts;
  }

  const { data: logs } = await supabase
    .from("attendance_logs")
    .select("session_id, scanned_at, time_out_at, attendance_status")
    .in("session_id", sessionIds);

  return buildLogCountsFromRows(logs ?? []);
}

export async function getCheckerNameMap(
  supabase: SupabaseServerClient,
  checkerIds: string[]
): Promise<Map<string, string>> {
  if (!checkerIds.length) return new Map();

  const { data } = await supabase
    .from("users")
    .select("id, full_name")
    .in("id", checkerIds);

  return new Map((data ?? []).map((checker) => [checker.id, checker.full_name]));
}
