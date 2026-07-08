import {
  AttendanceSessionStatus,
  AttendanceStatus,
  ResolvedAttendanceStatus,
} from "@/lib/attendeaseTypes";

export function formatDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(":");
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
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
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
