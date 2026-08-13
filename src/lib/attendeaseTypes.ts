import { AppRole } from "@/lib/constants";
import type { ResolvedAttendanceStatus } from "@/lib/attendance";

export type { ResolvedAttendanceStatus };

export const STUDENT_STATUSES = [
  "Active",
  "Inactive",
  "Transferred",
  "Graduated",
  "Archived",
] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export const SESSION_STATUSES = ["Draft", "Open", "Closed", "Archived"] as const;
export type AttendanceSessionStatus = (typeof SESSION_STATUSES)[number];

export const ATTENDANCE_STATUSES = [
  "Present",
  "Late",
  "Late (Excused)",
  "Absent",
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export type AppUserProfile = {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  status: "active" | "inactive" | "archived";
  department?: string | null;
  checker_scope?: "department" | "ssg" | "employee" | null;
};

export type StudentRecord = {
  id: string;
  student_number: string;
  full_name: string;
  qr_token: string;
  student_status: StudentStatus;
  created_at: string;
  updated_at: string;
};

export type StudentAcademicRecord = {
  id: string;
  student_id: string;
  department: string;
  course: string;
  year_level: string;
  academic_year: string;
  status: StudentStatus;
  created_at: string;
  updated_at: string;
};

export const MAIN_SESSION_STATUSES = ["Active", "Archived", "Trashed"] as const;
export type MainSessionStatus = (typeof MAIN_SESSION_STATUSES)[number];

export type AttendanceSession = {
  id: string;
  title: string;
  description: string | null;
  date: string;
  start_time: string;
  end_time: string;
  time_in_start: string | null;
  time_in_end: string | null;
  time_out_start: string | null;
  time_out_end: string | null;
  department: string | null;
  course: string | null;
  year_level: string | null;
  academic_year: string | null;
  /** Null = standalone session. Set = sub-session under a main session. */
  main_session_id: string | null;
  /** Parent main-session name when joined for display. */
  main_session_name?: string | null;
  assigned_checker_id: string | null;
  created_by: string | null;
  status: AttendanceSessionStatus;
  created_at: string;
  updated_at: string;
};

export type MainSession = {
  id: string;
  name: string;
  description: string | null;
  academic_year: string | null;
  department: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  status: MainSessionStatus;
  sub_session_count: number;
};

export type StudentWithAcademic = StudentRecord & {
  academic_record_id: string | null;
  department: string | null;
  course: string | null;
  year_level: string | null;
  academic_year: string | null;
};

export type StudentFormInput = {
  student_number: string;
  full_name: string;
  student_status: StudentStatus;
  department: string;
  course: string;
  year_level: string;
  academic_year: string;
};

/** Device/mod profile under an attendance_checker login account. */
export type CheckerProfileRow = {
  id: string;
  display_name: string;
  profile_role: "moderator" | "checker";
  status: "active" | "inactive";
  setup_completed: boolean;
  /** True when this profile's previous hashed PIN can still be restored. */
  canRestorePreviousPin?: boolean;
};

export type CheckerRow = {
  id: string;
  full_name: string;
  email: string;
  department: string | null;
  checker_scope: "department" | "ssg" | "employee";
  status: "active" | "inactive" | "archived";
  /** True when a previous hashed PIN can still be restored (undo window). */
  canRestorePreviousPin?: boolean;
  /** All checker_profiles for this account (moderator + checker); never filtered by role. */
  profiles?: CheckerProfileRow[];
};

export type StaffWithAssignment = {
  id: string;
  person_number: string;
  full_name: string;
  person_status: string;
  qr_token: string | null;
  assignment_id: string | null;
  department: string | null;
  job_title: string | null;
  assignment_status: string | null;
  created_at: string;
  updated_at: string;
};

export type SessionWithStats = AttendanceSession & {
  checker_name: string | null;
  present_count: number;
  late_count: number;
  late_excused_count: number;
  absent_count: number;
};

export type MainSessionGroup = {
  main: MainSession;
  subs: SessionWithStats[];
};

export type OrganizedSessions = {
  mainGroups: MainSessionGroup[];
  standalones: SessionWithStats[];
};

export type SessionAttendanceRow = {
  id: string;
  student_id: string;
  student_number: string;
  student_name: string;
  department: string | null;
  year_level: string | null;
  time_in: string | null;
  time_out: string | null;
  scan_by: string | null;
  attendance_status: ResolvedAttendanceStatus;
};

export type AttendanceReportRow = {
  id: string;
  session_id: string;
  student_number: string;
  student_name: string;
  department: string | null;
  date: string;
  session_title: string;
  year_level: string | null;
  time_in: string | null;
  time_out: string | null;
  scan_by: string | null;
  attendance_status: ResolvedAttendanceStatus;
};

export type DashboardStats = {
  activeCheckers: number;
  totalStudents: number;
  openSessionsToday: number;
  scansToday: number;
};

export type RecentActivityRow = {
  student_name: string;
  session_title: string;
  scanned_at: string;
};

export type RecentSessionRow = {
  id: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  department: string | null;
  status: AttendanceSession["status"];
  checker_name: string | null;
};
