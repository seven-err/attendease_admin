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

export function formatDateTimeOrDash(iso: string | null | undefined): string {
  if (!iso) return "—";
  return formatDateTime(iso);
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
): "status-present" | "status-late" | "status-absent" {
  switch (status) {
    case "Present":
      return "status-present";
    case "Late":
      return "status-late";
    case "On Time":
      return "status-present";
    case "Absent":
      return "status-absent";
    default:
      return "status-absent";
  }
}

export function attendanceStatusVariant(
  status: AttendanceStatus
): "status-present" | "status-late" | "status-absent" {
  switch (status) {
    case "Present":
      return "status-present";
    case "Late":
      return "status-late";
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
