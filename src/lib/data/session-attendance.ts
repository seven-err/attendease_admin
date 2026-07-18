import { resolveAttendanceStatus, summarizeAttendanceStatuses } from "@/lib/attendance";
import { AttendanceSession, SessionAttendanceRow } from "@/lib/attendeaseTypes";
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
  scanned_at: string;
  time_out_at: string | null;
  attendance_status: string;
};

type SessionScope = Pick<
  AttendanceSession,
  "department" | "course" | "year_level"
>;

const STUDENT_PAGE_SIZE = 1000;
const STUDENT_ID_CHUNK_SIZE = 200;

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

async function getCandidateStudentIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  session: SessionScope
): Promise<string[] | null> {
  if (!session.department && !session.course && !session.year_level) {
    return null;
  }

  let query = supabase.from("student_academic_records").select("student_id");

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
  if (error || !data) return [];

  return [...new Set(data.map((row) => row.student_id))];
}

async function fetchActiveStudentsByIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
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
  supabase: Awaited<ReturnType<typeof createClient>>
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

  const candidateIds = await getCandidateStudentIds(supabase, session);

  const [{ data: logs }, students] = await Promise.all([
    supabase
      .from("attendance_logs")
      .select("id, student_id, scanned_at, time_out_at, attendance_status")
      .eq("session_id", sessionId),
    candidateIds === null
      ? fetchAllActiveStudents(supabase)
      : fetchActiveStudentsByIds(supabase, candidateIds),
  ]);

  const logByStudent = new Map<string, AttendanceLogRow>();
  for (const log of (logs ?? []) as AttendanceLogRow[]) {
    logByStudent.set(log.student_id, log);
  }

  const roster: SessionAttendanceRow[] = [];

  for (const student of students) {
    const academic = pickLatestAcademic(student.student_academic_records);
    if (!studentMatchesSession(academic, session)) continue;

    const log = logByStudent.get(student.id);
    const status = resolveAttendanceStatus(
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
      attendance_status: status,
    });
  }

  roster.sort((a, b) => a.student_number.localeCompare(b.student_number));
  return roster;
}

export async function getSessionAttendanceSummary(sessionId: string) {
  const roster = await getSessionAttendanceRoster(sessionId);
  return summarizeAttendanceStatuses(
    roster.map((row) => row.attendance_status)
  );
}
