import {
  DashboardStats,
  RecentActivityRow,
  RecentSessionRow,
} from "@/lib/attendeaseTypes";
import { getCheckerNameMap } from "@/lib/data/session-helpers";
import { manilaDayBounds, todayDateString } from "@/lib/format";
import { CHECKER_ROLE } from "@/lib/constants";
import { createClient, SupabaseServerClient } from "@/lib/supabase/server";

async function fetchDashboardStats(
  supabase: SupabaseServerClient,
  today: string
): Promise<DashboardStats> {
  const { start, end } = manilaDayBounds(today);

  const [checkers, students, openSessions, scans] = await Promise.all([
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("role", CHECKER_ROLE)
      .eq("status", "active"),
    supabase.from("students").select("id", { count: "exact", head: true }),
    supabase
      .from("attendance_sessions")
      .select("id", { count: "exact", head: true })
      .eq("status", "Open")
      .eq("date", today),
    supabase
      .from("attendance_logs")
      .select("id", { count: "exact", head: true })
      .gte("scanned_at", start)
      .lte("scanned_at", end),
  ]);

  return {
    activeCheckers: checkers.count ?? 0,
    totalStudents: students.count ?? 0,
    openSessionsToday: openSessions.count ?? 0,
    scansToday: scans.count ?? 0,
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();
  return fetchDashboardStats(supabase, todayDateString());
}

export async function getRecentSessionSummaries(
  limit = 5
): Promise<RecentSessionRow[]> {
  const supabase = await createClient();

  const { data: sessions, error } = await supabase
    .from("attendance_sessions")
    .select(
      "id, title, date, start_time, end_time, department, status, assigned_checker_id"
    )
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

  const checkerMap = await getCheckerNameMap(supabase, checkerIds);

  return sessions.map((session) => ({
    id: session.id,
    title: session.title,
    date: session.date,
    start_time: session.start_time,
    end_time: session.end_time,
    department: session.department,
    status: session.status,
    checker_name: session.assigned_checker_id
      ? (checkerMap.get(session.assigned_checker_id) ?? null)
      : null,
  }));
}

export async function getRecentActivity(
  limit = 5
): Promise<RecentActivityRow[]> {
  const supabase = await createClient();

  const { data: logs, error } = await supabase
    .from("attendance_logs")
    .select("scanned_at, students(full_name), attendance_sessions(title)")
    .order("scanned_at", { ascending: false })
    .limit(limit);

  if (error || !logs?.length) return [];

  return logs.map((log) => {
    const student = Array.isArray(log.students)
      ? log.students[0]
      : log.students;
    const session = Array.isArray(log.attendance_sessions)
      ? log.attendance_sessions[0]
      : log.attendance_sessions;

    return {
      student_name:
        (student as { full_name: string } | null)?.full_name ?? "Unknown",
      session_title:
        (session as { title: string } | null)?.title ?? "Unknown",
      scanned_at: log.scanned_at,
    };
  });
}
