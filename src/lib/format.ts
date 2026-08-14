import {
  AttendanceSessionStatus,
  AttendanceStatus,
  ResolvedAttendanceStatus,
} from "@/lib/attendeaseTypes";
import { APP_TIMEZONE } from "@/lib/constants";

const dateTimeOptions = {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: APP_TIMEZONE,
} as const;

const dateOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: APP_TIMEZONE,
} as const;

const timeOptions = {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: APP_TIMEZONE,
} as const;

export function formatDate(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00+08:00`);
  return date.toLocaleDateString("en-US", dateOptions);
}

export function formatTime(timeStr: string): string {
  const [hours, minutes, seconds = "0"] = timeStr.split(":");
  const padded = `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}:${seconds.padStart(2, "0")}`;
  const date = new Date(`1970-01-01T${padded}+08:00`);
  return date.toLocaleTimeString("en-US", timeOptions);
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", dateTimeOptions);
}

/** Full date+time for audit / CSV; prefer formatClockTime* in attendance UI. */
export function formatDateTimeOrDash(iso: string | null | undefined): string {
  if (!iso) return "—";
  return formatDateTime(iso);
}

/** Time-only from an ISO timestamp (attendance Time In / Time Out UI). */
export function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", timeOptions);
}

export function formatClockTimeOrDash(iso: string | null | undefined): string {
  if (!iso) return "—";
  return formatClockTime(iso);
}

/** Time In column: show "No Time In" when timed out without time in. */
export function formatTimeInDisplay(
  timeIn: string | null | undefined,
  timeOut: string | null | undefined
): string {
  if (timeIn) return formatClockTime(timeIn);
  if (timeOut) return "No Time In";
  return "—";
}

/** Time Out column: show "No Time Out" when timed in without time out. */
export function formatTimeOutDisplay(
  timeIn: string | null | undefined,
  timeOut: string | null | undefined
): string {
  if (timeOut) return formatClockTime(timeOut);
  if (timeIn) return "No Time Out";
  return "—";
}

/** Badge / column label (e.g. Late (Excused) → LATE (EXCUSED)). */
export function displayAttendanceStatus(
  status: ResolvedAttendanceStatus | AttendanceStatus | string
): string {
  return status.toUpperCase();
}

/** Label for filters, dropdowns, and summary cards. */
export function displayAttendanceStatusLabel(
  status: ResolvedAttendanceStatus | AttendanceStatus | string
): string {
  return status;
}

/** `datetime-local` value in Asia/Manila for editing stored UTC timestamps. */
export function toManilaDateTimeLocal(
  iso: string | null | undefined
): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Parse a Manila `datetime-local` string into a UTC ISO timestamp. */
export function manilaDateTimeLocalToIso(
  value: string | null | undefined
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const date = new Date(`${trimmed}:00+08:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function truncateToken(token: string, visible = 8): string {
  if (token.length <= visible + 3) return token;
  return `${token.slice(0, visible)}...`;
}

export function displayUserStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function displayCheckerScope(scope: string): string {
  return scope === "ssg" ? "SSG" : "Department";
}

export function displaySessionStatus(status: AttendanceSessionStatus): string {
  if (status === "Open") return "● OPEN";
  return status.toUpperCase();
}

export function sessionStatusVariant(
  status: AttendanceSessionStatus
): "status-open" | "status-active" | "status-closed" | "status-draft" {
  switch (status) {
    case "Open":
      return "status-active";
    case "Closed":
    case "Archived":
      return "status-closed";
    case "Draft":
      return "status-draft";
    default:
      return "status-draft";
  }
}

export function resolvedAttendanceStatusVariant(
  status: ResolvedAttendanceStatus
):
  | "status-present"
  | "status-late"
  | "status-late-excused"
  | "status-absent"
  | "status-draft" {
  switch (status) {
    case "Present":
      return "status-present";
    case "Late":
      return "status-late";
    case "Late (Excused)":
      return "status-late-excused";
    case "No Time In":
      return "status-draft";
    case "Absent":
    case "Voided":
      return "status-absent";
    default:
      return "status-absent";
  }
}

export function attendanceStatusVariant(
  status: AttendanceStatus
): "status-present" | "status-late" | "status-late-excused" | "status-absent" {
  switch (status) {
    case "Present":
      return "status-present";
    case "Late":
      return "status-late";
    case "Late (Excused)":
      return "status-late-excused";
    case "Absent":
      return "status-absent";
    default:
      return "status-present";
  }
}

export function todayDateString(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: APP_TIMEZONE });
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const anchor = new Date(`${dateStr}T12:00:00+08:00`);
  anchor.setTime(anchor.getTime() + days * 24 * 60 * 60 * 1000);
  return anchor.toLocaleDateString("en-CA", { timeZone: APP_TIMEZONE });
}

export function manilaDayBounds(dateStr: string): { start: string; end: string } {
  return {
    start: `${dateStr}T00:00:00+08:00`,
    end: `${dateStr}T23:59:59.999+08:00`,
  };
}
