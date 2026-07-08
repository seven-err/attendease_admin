import { SessionWithStats } from "@/lib/attendeaseTypes";
import {
  onTimeCount,
  emptyLogCounts,
} from "@/lib/data/session-stats";
import {
  getCheckerNameMap,
  getSessionLogCounts,
} from "@/lib/data/session-helpers";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_SESSION_LIMIT = 100;

export async function getSessions(
  limit = DEFAULT_SESSION_LIMIT
): Promise<SessionWithStats[]> {
  const supabase = await createClient();

  const { data: sessions, error } = await supabase
    .from("attendance_sessions")
    .select("*")
    .order("date", { ascending: false })
    .order("start_time", { ascending: false })
    .limit(limit);

  if (error || !sessions?.length) return [];

  const checkerIds = [
    ...new Set(
      sessions
        .map((session) => session.assigned_checker_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const sessionIds = sessions.map((session) => session.id);

  const [checkerMap, logCounts] = await Promise.all([
    getCheckerNameMap(supabase, checkerIds),
    getSessionLogCounts(supabase, sessionIds),
  ]);

  return sessions.map((session) => {
    const counts = logCounts.get(session.id) ?? emptyLogCounts();

    return {
      ...session,
      checker_name: session.assigned_checker_id
        ? (checkerMap.get(session.assigned_checker_id) ?? null)
        : null,
      present_count: counts.present,
      late_count: counts.late,
      absent_count: counts.absent,
      on_time_count: onTimeCount(counts),
    };
  });
}
