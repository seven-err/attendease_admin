import { AttendanceStatus } from "@/lib/attendeaseTypes";

/** Present only when both time-in and time-out are recorded. */
export type ResolvedAttendanceStatus = AttendanceStatus | "On Time";

export function resolveAttendanceStatus(
  scannedAt: string | null | undefined,
  timeOutAt: string | null | undefined,
  storedStatus?: string | null
): ResolvedAttendanceStatus {
  if (!scannedAt) return "Absent";
  if (storedStatus === "Late") return "Late";
  if (timeOutAt) return "Present";
  return "On Time";
}

export function isCompleteAttendance(
  scannedAt: string | null | undefined,
  timeOutAt: string | null | undefined
): boolean {
  return Boolean(scannedAt && timeOutAt);
}

export type AttendanceCountSummary = {
  present: number;
  late: number;
  absent: number;
  onTime: number;
};

export function summarizeAttendanceStatuses(
  statuses: ResolvedAttendanceStatus[]
): AttendanceCountSummary {
  const summary: AttendanceCountSummary = {
    present: 0,
    late: 0,
    absent: 0,
    onTime: 0,
  };

  for (const status of statuses) {
    if (status === "Present") summary.present++;
    else if (status === "Late") summary.late++;
    else if (status === "On Time") summary.onTime++;
    else summary.absent++;
  }

  return summary;
}
