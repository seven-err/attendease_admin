import {
  AttendanceSessionStatus,
  SESSION_STATUSES,
} from "@/lib/attendeaseTypes";
import { DEPARTMENTS, YEAR_LEVELS } from "@/lib/constants";
import { currentAcademicYear } from "@/lib/validations/student";

export type SessionActionResult =
  | { success: true }
  | { success: false; error: string };

export type SessionFormInput = {
  title: string;
  description: string;
  date: string;
  time_in_start: string;
  time_in_end: string;
  time_out_start: string;
  time_out_end: string;
  department: string;
  course: string;
  year_level: string;
  academic_year: string;
  assigned_checker_id: string;
  status: AttendanceSessionStatus;
};

function isSessionStatus(value: string): value is AttendanceSessionStatus {
  return (SESSION_STATUSES as readonly string[]).includes(value);
}

export function normalizeTimeForDb(time: string): string {
  const trimmed = time.trim();
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
  return trimmed;
}

export function normalizeTimeForInput(time: string): string {
  const match = time.match(/^(\d{2}:\d{2})/);
  return match ? match[1] : time;
}

function compareStoredTimes(left: string, right: string): number {
  return normalizeTimeForDb(left).localeCompare(normalizeTimeForDb(right));
}

export function parseSessionForm(formData: FormData): SessionFormInput {
  const status = String(formData.get("status") ?? "Draft");
  return {
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    date: String(formData.get("date") ?? "").trim(),
    time_in_start: normalizeTimeForDb(
      String(formData.get("time_in_start") ?? "").trim()
    ),
    time_in_end: normalizeTimeForDb(
      String(formData.get("time_in_end") ?? "").trim()
    ),
    time_out_start: normalizeTimeForDb(
      String(formData.get("time_out_start") ?? "").trim()
    ),
    time_out_end: normalizeTimeForDb(
      String(formData.get("time_out_end") ?? "").trim()
    ),
    department: String(formData.get("department") ?? "").trim(),
    course: String(formData.get("course") ?? "").trim(),
    year_level: String(formData.get("year_level") ?? "").trim(),
    academic_year: String(formData.get("academic_year") ?? "").trim(),
    assigned_checker_id: String(formData.get("assigned_checker_id") ?? "").trim(),
    status: isSessionStatus(status) ? status : "Draft",
  };
}

export function validateSessionForm(
  input: SessionFormInput
): SessionActionResult | null {
  if (!input.title) {
    return { success: false, error: "Session title is required." };
  }
  if (!input.date) {
    return { success: false, error: "Date is required." };
  }
  if (
    !input.time_in_start ||
    !input.time_in_end ||
    !input.time_out_start ||
    !input.time_out_end
  ) {
    return {
      success: false,
      error: "Time In and Time Out windows are required.",
    };
  }
  if (compareStoredTimes(input.time_in_end, input.time_in_start) <= 0) {
    return {
      success: false,
      error: "Time In limit must be later than Time In start.",
    };
  }
  if (compareStoredTimes(input.time_out_end, input.time_out_start) <= 0) {
    return {
      success: false,
      error: "Time Out limit must be later than Time Out start.",
    };
  }
  if (compareStoredTimes(input.time_out_start, input.time_in_end) < 0) {
    return {
      success: false,
      error: "Time Out start must be at or after the Time In limit.",
    };
  }
  if (!input.department) {
    return { success: false, error: "Department is required." };
  }
  if (!(DEPARTMENTS as readonly string[]).includes(input.department)) {
    return { success: false, error: "Invalid department." };
  }
  if (input.year_level && !(YEAR_LEVELS as readonly string[]).includes(input.year_level)) {
    return { success: false, error: "Invalid year level." };
  }
  if (!isSessionStatus(input.status)) {
    return { success: false, error: "Invalid session status." };
  }
  if (input.status === "Open" && !input.assigned_checker_id) {
    return {
      success: false,
      error: "Assign a checker before opening the session.",
    };
  }
  return null;
}

export function sessionPayloadFromInput(
  input: SessionFormInput,
  createdBy?: string | null
) {
  return {
    title: input.title,
    description: input.description || null,
    date: input.date,
    start_time: input.time_in_start,
    end_time: input.time_out_end,
    time_in_start: input.time_in_start,
    time_in_end: input.time_in_end,
    time_out_start: input.time_out_start,
    time_out_end: input.time_out_end,
    department: input.department,
    course: input.course || null,
    year_level: input.year_level || null,
    academic_year: input.academic_year || currentAcademicYear(),
    assigned_checker_id: input.assigned_checker_id || null,
    status: input.status,
    ...(createdBy ? { created_by: createdBy } : {}),
  };
}
