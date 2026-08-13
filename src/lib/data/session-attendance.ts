import { resolveAttendanceStatus, summarizeAttendanceStatuses } from "@/lib/attendance";
import { AttendanceSession, SessionAttendanceRow } from "@/lib/attendeaseTypes";
import { getCheckerProfileNameMap } from "@/lib/data/session-helpers";
import {
  emptyLogCounts,
  type SessionLogCounts,
  type SessionLogCountsMap,
} from "@/lib/data/session-stats";
import { createClient } from "@/lib/supabase/server";

export type { SessionAttendanceRow };

type AcademicRecordRow = {
  department: string;
  course: string;
  year_level: string;
  created_at: string;
};

type StudentRow = {
  id: string;
  student_number: string;
  full_name: string;
  student_academic_records:
    | AcademicRecordRow[]
    | AcademicRecordRow
    | null;
};

type AttendanceLogRow = {
  id: string;
  student_id: string;
  checker_id: string | null;
  scanned_at: string;
  time_out_at: string | null;
  attendance_status: string;
  device_id: string | null;
};

type AttendanceLogCountRow = {
  session_id: string;
  student_id: string;
  scanned_at: string | null;
  time_out_at: string | null;
  attendance_status: string;
  device_id: string | null;
};

type SessionScope = Pick<
  AttendanceSession,
  "department" | "course" | "year_level"
>;

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const STUDENT_PAGE_SIZE = 1000;
/**
 * Keep `.in(id, …)` chunks small. Large UUID lists (≈200–400+) make the
 * PostgREST URL fail and return an empty list — the same failure mode
 * fixed for students.ts via !inner. Session rosters still need an unfiltered
 * academic embed so "latest record" matching stays correct, so we chunk
 * instead of switching to !inner.
 */
const STUDENT_ID_CHUNK_SIZE = 50;
const SESSION_ID_CHUNK_SIZE = 50;
const LOG_PAGE_SIZE = 1000;
const ACADEMIC_ID_PAGE_SIZE = 1000;

const STUDENT_ROSTER_SELECT = `
  id,
  student_number,
  full_name,
  student_academic_records (
    department,
    course,
    year_level,
    created_at
  )
`;

const LOG_COUNT_SELECT =
  "session_id, student_id, scanned_at, time_out_at, attendance_status, device_id";

const LOG_ROSTER_SELECT =
  "id, student_id, checker_id, scanned_at, time_out_at, attendance_status, device_id";

function pickLatestAcademic(
  records: StudentRow["student_academic_records"]
): AcademicRecordRow | undefined {
  const list = Array.isArray(records)
    ? records
    : records
      ? [records]
      : [];

  return list.reduce<AcademicRecordRow | undefined>((latest, record) => {
    if (!latest || record.created_at > latest.created_at) return record;
    return latest;
  }, undefined);
}

function studentMatchesSession(
  academic: AcademicRecordRow | undefined,
  session: SessionScope
): boolean {
  if (!academic) return false;
  if (session.department && academic.department !== session.department) {
    return false;
  }
  if (session.course && academic.course !== session.course) return false;
  if (session.year_level && academic.year_level !== session.year_level) {
    return false;
  }
  return true;
}

function chunkIds(ids: string[], size: number): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}

function hasScopeFilter(session: SessionScope): boolean {
  return Boolean(session.department || session.course || session.year_level);
}

/**
 * Student IDs that have at least one academic row matching the session scope.
 * Paginated — a single unscoped-by-year department query can exceed the
 * PostgREST default 1000-row cap.
 */
async function getCandidateStudentIds(
  supabase: SupabaseClient,
  session: SessionScope
): Promise<string[] | null> {
  if (!hasScopeFilter(session)) {
    return null;
  }

  const studentIds = new Set<string>();
  let from = 0;

  while (true) {
    let query = supabase
      .from("student_academic_records")
      .select("student_id")
      .order("student_id", { ascending: true })
      .range(from, from + ACADEMIC_ID_PAGE_SIZE - 1);

    if (session.department) {
      query = query.eq("department", session.department);
    }
    if (session.course) {
      query = query.eq("course", session.course);
    }
    if (session.year_level) {
      query = query.eq("year_level", session.year_level);
    }

    const { data, error } = await query;
    if (error || !data?.length) break;

    for (const row of data) {
      if (row.student_id) studentIds.add(row.student_id as string);
    }

    if (data.length < ACADEMIC_ID_PAGE_SIZE) break;
    from += ACADEMIC_ID_PAGE_SIZE;
  }

  return [...studentIds];
}

async function fetchActiveStudentsByIds(
  supabase: SupabaseClient,
  studentIds: string[]
): Promise<StudentRow[]> {
  if (studentIds.length === 0) return [];

  const students: StudentRow[] = [];

  for (const ids of chunkIds(studentIds, STUDENT_ID_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("students")
      .select(STUDENT_ROSTER_SELECT)
      .eq("student_status", "Active")
      .in("id", ids)
      .order("student_number", { ascending: true });

    if (error || !data) continue;
    students.push(...(data as StudentRow[]));
  }

  return students;
}

async function fetchAllActiveStudents(
  supabase: SupabaseClient
): Promise<StudentRow[]> {
  const students: StudentRow[] = [];
  let from = 0;

  while (true) {
    const to = from + STUDENT_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("students")
      .select(STUDENT_ROSTER_SELECT)
      .eq("student_status", "Active")
      .order("student_number", { ascending: true })
      .range(from, to);

    if (error || !data?.length) break;

    students.push(...(data as StudentRow[]));

    if (data.length < STUDENT_PAGE_SIZE) break;
    from += STUDENT_PAGE_SIZE;
  }

  return students;
}

async function fetchActiveStudentsForScope(
  supabase: SupabaseClient,
  session: SessionScope
): Promise<StudentRow[]> {
  const candidateIds = await getCandidateStudentIds(supabase, session);
  if (candidateIds === null) {
    return fetchAllActiveStudents(supabase);
  }
  return fetchActiveStudentsByIds(supabase, candidateIds);
}

async function fetchPagedLogsForSessionIds<T>(
  supabase: SupabaseClient,
  sessionIds: string[],
  select: string
): Promise<T[]> {
  if (!sessionIds.length) return [];

  const logs: T[] = [];

  for (const ids of chunkIds(sessionIds, SESSION_ID_CHUNK_SIZE)) {
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("attendance_logs")
        .select(select)
        .in("session_id", ids)
        .order("id", { ascending: true })
        .range(from, from + LOG_PAGE_SIZE - 1);

      if (error || !data?.length) break;

      logs.push(...(data as T[]));

      if (data.length < LOG_PAGE_SIZE) break;
      from += LOG_PAGE_SIZE;
    }
  }

  return logs;
}

async function fetchLogsForSessionIds(
  supabase: SupabaseClient,
  sessionIds: string[]
): Promise<AttendanceLogCountRow[]> {
  return fetchPagedLogsForSessionIds<AttendanceLogCountRow>(
    supabase,
    sessionIds,
    LOG_COUNT_SELECT
  );
}

async function fetchRosterLogsForSession(
  supabase: SupabaseClient,
  sessionId: string
): Promise<AttendanceLogRow[]> {
  return fetchPagedLogsForSessionIds<AttendanceLogRow>(
    supabase,
    [sessionId],
    LOG_ROSTER_SELECT
  );
}

function tallyScopedCounts(
  students: StudentRow[],
  session: SessionScope,
  logByStudent: Map<string, AttendanceLogCountRow>
): SessionLogCounts {
  const sessionCounts = emptyLogCounts();

  for (const student of students) {
    const academic = pickLatestAcademic(student.student_academic_records);
    if (!studentMatchesSession(academic, session)) continue;

    const log = logByStudent.get(student.id);
    const status =
      log?.device_id === "__voided__"
        ? "Voided"
        : resolveAttendanceStatus(
            log?.scanned_at,
            log?.time_out_at,
            log?.attendance_status
          );

    if (status === "Present") sessionCounts.present++;
    else if (status === "Late") sessionCounts.late++;
    else if (status === "Late (Excused)") sessionCounts.lateExcused++;
    else sessionCounts.absent++;
  }

  return sessionCounts;
}

export async function getSessionAttendanceRoster(
  sessionId: string
): Promise<SessionAttendanceRow[]> {
  const supabase = await createClient();

  const { data: session, error: sessionError } = await supabase
    .from("attendance_sessions")
    .select("id, department, course, year_level")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError || !session) return [];

  const [typedLogs, students] = await Promise.all([
    fetchRosterLogsForSession(supabase, sessionId),
    fetchActiveStudentsForScope(supabase, session),
  ]);

  const logByStudent = new Map<string, AttendanceLogRow>();
  for (const log of typedLogs) {
    logByStudent.set(log.student_id, log);
  }

  const checkerIds = [
    ...new Set(
      typedLogs
        .map((log) => log.checker_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const checkerMap = await getCheckerProfileNameMap(supabase, checkerIds);

  const roster: SessionAttendanceRow[] = [];

  for (const student of students) {
    const academic = pickLatestAcademic(student.student_academic_records);
    if (!studentMatchesSession(academic, session)) continue;

    const log = logByStudent.get(student.id);
    const status =
      log?.device_id === "__voided__"
        ? "Voided"
        : resolveAttendanceStatus(
            log?.scanned_at,
            log?.time_out_at,
            log?.attendance_status
          );

    roster.push({
      id: log?.id ?? `absent-${student.id}`,
      student_id: student.id,
      student_number: student.student_number,
      student_name: student.full_name,
      department: academic?.department ?? session.department,
      year_level: academic?.year_level ?? null,
      time_in: log?.scanned_at ?? null,
      time_out: log?.time_out_at ?? null,
      scan_by: log?.checker_id
        ? (checkerMap.get(log.checker_id) ?? null)
        : null,
      attendance_status: status,
    });
  }

  roster.sort((a, b) => a.student_number.localeCompare(b.student_number));
  return roster;
}

export async function getSessionAttendanceSummary(sessionId: string) {
  const roster = await getSessionAttendanceRoster(sessionId);
  return summarizeAttendanceStatuses(roster);
}

type SessionCountInput = {
  id: string;
  department: string | null;
  course: string | null;
  year_level: string | null;
};

function sessionScopeKey(session: SessionScope): string {
  return [
    session.department ?? "",
    session.course ?? "",
    session.year_level ?? "",
  ].join("|");
}

type ScopedCountRpcRow = {
  session_id: string;
  present_count: number | string;
  late_count: number | string;
  late_excused_count: number | string;
  absent_count: number | string;
};

function mapRpcCounts(rows: ScopedCountRpcRow[]): SessionLogCountsMap {
  const counts: SessionLogCountsMap = new Map();
  for (const row of rows) {
    counts.set(row.session_id, {
      present: Number(row.present_count ?? 0),
      late: Number(row.late_count ?? 0),
      lateExcused: Number(row.late_excused_count ?? 0),
      absent: Number(row.absent_count ?? 0),
    });
  }
  return counts;
}

function tallyLogsOnly(logs: AttendanceLogCountRow[]): SessionLogCounts {
  const sessionCounts = emptyLogCounts();
  for (const log of logs) {
    if (log.device_id === "__voided__") continue;
    const status = resolveAttendanceStatus(
      log.scanned_at,
      log.time_out_at,
      log.attendance_status
    );
    if (status === "Present") sessionCounts.present++;
    else if (status === "Late") sessionCounts.late++;
    else if (status === "Late (Excused)") sessionCounts.lateExcused++;
  }
  return sessionCounts;
}

/**
 * Batch Present / Late / Late (Excused) / Absent counts for session cards.
 * Prefers the DB RPC (scoped to latest academic department/course/year_level).
 * Falls back to JS roster tally, then to log-only Present/Late if roster is empty
 * so cards never show 0/0/0 when scans exist.
 */
export async function getScopedSessionCounts(
  sessions: SessionCountInput[]
): Promise<SessionLogCountsMap> {
  const counts: SessionLogCountsMap = new Map();
  if (!sessions.length) return counts;

  const supabase = await createClient();
  const sessionIds = sessions.map((session) => session.id);

  const { data: rpcRows, error: rpcError } = await supabase.rpc(
    "get_scoped_session_counts",
    { p_session_ids: sessionIds }
  );

  if (!rpcError && Array.isArray(rpcRows)) {
    const rpcCounts = mapRpcCounts(rpcRows as ScopedCountRpcRow[]);
    for (const session of sessions) {
      counts.set(session.id, rpcCounts.get(session.id) ?? emptyLogCounts());
    }

    // If RPC returned zeros for sessions that have scans, repair via log tally.
    const zeroScanSessionIds = sessions
      .filter((session) => {
        const c = counts.get(session.id) ?? emptyLogCounts();
        return c.present + c.late + c.lateExcused === 0;
      })
      .map((session) => session.id);

    if (zeroScanSessionIds.length > 0) {
      const repairLogs = await fetchLogsForSessionIds(
        supabase,
        zeroScanSessionIds
      );
      const logsBySessionId = new Map<string, AttendanceLogCountRow[]>();
      for (const log of repairLogs) {
        const list = logsBySessionId.get(log.session_id) ?? [];
        list.push(log);
        logsBySessionId.set(log.session_id, list);
      }
      for (const sessionId of zeroScanSessionIds) {
        const sessionLogs = logsBySessionId.get(sessionId) ?? [];
        const fromLogs = tallyLogsOnly(sessionLogs);
        if (fromLogs.present + fromLogs.late + fromLogs.lateExcused > 0) {
          const existing = counts.get(sessionId) ?? emptyLogCounts();
          counts.set(sessionId, {
            ...fromLogs,
            absent: existing.absent,
          });
        }
      }
    }

    return counts;
  }

  // RPC unavailable — previous JS roster path.
  const scopes = uniqueScopes(sessions);
  const [allLogs, scopeEntries] = await Promise.all([
    fetchLogsForSessionIds(supabase, sessionIds),
    Promise.all(
      scopes.map(async (scope) => ({
        key: sessionScopeKey(scope),
        students: await fetchActiveStudentsForScope(supabase, scope),
      }))
    ),
  ]);

  const logsBySessionId = new Map<string, AttendanceLogCountRow[]>();
  for (const log of allLogs) {
    const list = logsBySessionId.get(log.session_id) ?? [];
    list.push(log);
    logsBySessionId.set(log.session_id, list);
  }

  const studentsByScope = new Map<string, StudentRow[]>();
  for (const entry of scopeEntries) {
    studentsByScope.set(entry.key, entry.students);
  }

  for (const session of sessions) {
    const students = studentsByScope.get(sessionScopeKey(session)) ?? [];
    const sessionLogs = logsBySessionId.get(session.id) ?? [];
    const logByStudent = new Map(
      sessionLogs.map((log) => [log.student_id, log])
    );
    const scoped = tallyScopedCounts(students, session, logByStudent);
    const scannedScoped = scoped.present + scoped.late + scoped.lateExcused;
    const fromLogs = tallyLogsOnly(sessionLogs);
    const scannedLogs = fromLogs.present + fromLogs.late + fromLogs.lateExcused;

    if (scannedScoped === 0 && scannedLogs > 0) {
      counts.set(session.id, { ...fromLogs, absent: scoped.absent });
    } else {
      counts.set(session.id, scoped);
    }
  }

  return counts;
}

function uniqueScopes(sessions: SessionCountInput[]): SessionScope[] {
  const seen = new Set<string>();
  const scopes: SessionScope[] = [];
  for (const session of sessions) {
    const key = sessionScopeKey(session);
    if (seen.has(key)) continue;
    seen.add(key);
    scopes.push({
      department: session.department,
      course: session.course,
      year_level: session.year_level,
    });
  }
  return scopes;
}
