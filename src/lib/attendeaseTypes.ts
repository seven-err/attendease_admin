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

export const ATTENDANCE_STATUSES = ["Present", "Late", "Absent"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export type AppUserProfile = {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  status: "active" | "inactive" | "archived";
  department?: string | null;
  checker_scope?: "department" | "ssg" | null;
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
  assigned_checker_id: string | null;
  created_by: string | null;
  status: AttendanceSessionStatus;
  created_at: string;
  updated_at: string;
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

export type CheckerRow = {
  id: string;
  full_name: string;
  email: string;
  department: string | null;
  checker_scope: "department" | "ssg";
  status: "active" | "inactive" | "archived";
};

export type SessionWithStats = AttendanceSession & {
  checker_name: string | null;
  present_count: number;
  late_count: number;
  absent_count: number;
  on_time_count: number;
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
