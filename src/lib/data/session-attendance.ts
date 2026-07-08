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
  session: Pick<
    AttendanceSession,
    "department" | "course" | "year_level"
  >
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

  const [{ data: students }, { data: logs }] = await Promise.all([
    supabase
      .from("students")
      .select(
        `
        id,
        student_number,
        full_name,
        student_academic_records (
          department,
          course,
          year_level,
          created_at
        )
      `
      )
      .eq("student_status", "Active")
      .order("student_number", { ascending: true }),
    supabase
      .from("attendance_logs")
      .select("id, student_id, scanned_at, time_out_at, attendance_status")
      .eq("session_id", sessionId),
  ]);

  const logByStudent = new Map<string, AttendanceLogRow>();
  for (const log of (logs ?? []) as AttendanceLogRow[]) {
    logByStudent.set(log.student_id, log);
  }

  const roster: SessionAttendanceRow[] = [];

  for (const student of (students ?? []) as StudentRow[]) {
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
