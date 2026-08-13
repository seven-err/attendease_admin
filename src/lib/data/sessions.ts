import { SessionWithStats } from "@/lib/attendeaseTypes";
import { emptyLogCounts } from "@/lib/data/session-stats";
import { getScopedSessionCounts } from "@/lib/data/session-attendance";
import { getCheckerNameMap } from "@/lib/data/session-helpers";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_SESSION_LIMIT = 200;

type SessionRow = SessionWithStats & {
  main_sessions?: { name: string } | { name: string }[] | null;
};

function resolveMainSessionName(
  row: SessionRow
): string | null {
  if (row.main_session_name) return row.main_session_name;
  const joined = row.main_sessions;
  if (!joined) return null;
  if (Array.isArray(joined)) return joined[0]?.name ?? null;
  return joined.name ?? null;
}

export async function getSessions(
  limit = DEFAULT_SESSION_LIMIT
): Promise<SessionWithStats[]> {
  const supabase = await createClient();

  const { data: sessions, error } = await supabase
    .from("attendance_sessions")
    .select("*, main_sessions(name)")
    .neq("status", "Trashed")
    .order("date", { ascending: false })
    .order("start_time", { ascending: false })
    .limit(limit);

  if (error || !sessions?.length) return [];

  const typedSessions = sessions as SessionRow[];
  const checkerIds = [
    ...new Set(
      typedSessions
        .map((session) => session.assigned_checker_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const [checkerMap, logCounts] = await Promise.all([
    getCheckerNameMap(supabase, checkerIds),
    getScopedSessionCounts(
      typedSessions.map((session) => ({
        id: session.id,
        department: session.department,
        course: session.course,
        year_level: session.year_level,
      }))
    ),
  ]);

  return typedSessions.map((session) => {
    const counts = logCounts.get(session.id) ?? emptyLogCounts();
    // Drop the joined relation object from the mapped row.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { main_sessions, ...rest } = session;

    return {
      ...rest,
      main_session_id: session.main_session_id ?? null,
      main_session_name: resolveMainSessionName(session),
      checker_name: session.assigned_checker_id
        ? (checkerMap.get(session.assigned_checker_id) ?? null)
        : null,
      present_count: counts.present,
      late_count: counts.late,
      late_excused_count: counts.lateExcused,
      absent_count: counts.absent,
    };
  });
}
