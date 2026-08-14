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
  late_excused_count?: number;
  absent_count: number;
};

type AttendanceLogStatusRow = {
  session_id: string;
  scanned_at: string | null;
  time_out_at: string | null;
  attendance_status: string | null;
  device_id?: string | null;
};

function buildLogCountsFromRows(
  rows: AttendanceLogStatusRow[]
): SessionLogCountsMap {
  const logCounts: SessionLogCountsMap = new Map();

  for (const log of rows) {
    if (log.device_id === "__voided__") continue;

    const counts = logCounts.get(log.session_id) ?? emptyLogCounts();
    const status = resolveAttendanceStatus(
      log.scanned_at,
      log.time_out_at,
      log.attendance_status
    );
    if (status === "Present") counts.present++;
    else if (status === "Late") counts.late++;
    else if (status === "Late (Excused)") counts.lateExcused++;
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
    const sample = data[0] as LogCountRow & Record<string, unknown>;
    // Prefer client-side resolve until the Late (Excused) migration is applied.
    if ("late_excused_count" in sample) {
      const logCounts: SessionLogCountsMap = new Map();
      for (const row of data as LogCountRow[]) {
        logCounts.set(row.session_id, {
          present: Number(row.present_count ?? 0),
          late: Number(row.late_count ?? 0),
          lateExcused: Number(row.late_excused_count ?? 0),
          absent: Number(row.absent_count ?? 0),
        });
      }
      return logCounts;
    }
  }

  const { data: logs } = await supabase
    .from("attendance_logs")
    .select("session_id, scanned_at, time_out_at, attendance_status, device_id")
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

/**
 * Resolve scanner names for attendance_logs.checker_id values.
 * Those IDs point at checker_profiles (device/mod profiles), not users accounts.
 */
export async function getCheckerProfileNameMap(
  supabase: SupabaseServerClient,
  profileIds: string[]
): Promise<Map<string, string>> {
  if (!profileIds.length) return new Map();

  const { data: profiles } = await supabase
    .from("checker_profiles")
    .select("id, display_name, account_id")
    .in("id", profileIds);

  const rows = profiles ?? [];
  const accountIds = [
    ...new Set(
      rows
        .map((row) => row.account_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const accountMap = await getCheckerNameMap(supabase, accountIds);
  const nameMap = new Map<string, string>();

  for (const row of rows) {
    const displayName =
      typeof row.display_name === "string" ? row.display_name.trim() : "";
    const accountName = row.account_id
      ? accountMap.get(row.account_id as string)
      : undefined;
    const name = displayName || accountName;
    if (name) nameMap.set(row.id as string, name);
  }

  return nameMap;
}
