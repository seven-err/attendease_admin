import { AttendanceStatus } from "@/lib/attendeaseTypes";

export type ResolvedAttendanceStatus =
  | AttendanceStatus
  | "Voided";

export type AttendanceSummaryInput = {
  attendance_status: ResolvedAttendanceStatus;
  time_in?: string | null;
  time_out?: string | null;
};

export function resolveAttendanceStatus(
  scannedAt: string | null | undefined,
  _timeOutAt: string | null | undefined,
  storedStatus?: string | null
): ResolvedAttendanceStatus {
  if (storedStatus === "Voided") return "Voided";
  if (!scannedAt) return "Absent";
  if (storedStatus === "Late (Excused)") return "Late (Excused)";
  if (storedStatus === "Late") return "Late";
  return "Present";
}

export function isCompleteAttendance(
  scannedAt: string | null | undefined,
  timeOutAt: string | null | undefined
): boolean {
  return Boolean(scannedAt && timeOutAt);
}

export function hasNoTimeOut(
  scannedAt: string | null | undefined,
  timeOutAt: string | null | undefined
): boolean {
  return Boolean(scannedAt && !timeOutAt);
}

/** Status filter value for students who timed in but never timed out. */
export const NO_TIME_OUT_FILTER = "No Time Out" as const;

export function matchesAttendanceStatusFilter(
  row: AttendanceSummaryInput,
  statusFilter: string | null | undefined
): boolean {
  if (!statusFilter || statusFilter === "all") return true;
  if (statusFilter === NO_TIME_OUT_FILTER) {
    return hasNoTimeOut(row.time_in, row.time_out);
  }
  return row.attendance_status === statusFilter;
}

export type AttendanceCountSummary = {
  present: number;
  late: number;
  lateExcused: number;
  absent: number;
  noTimeOut: number;
};

export function emptyAttendanceSummary(): AttendanceCountSummary {
  return {
    present: 0,
    late: 0,
    lateExcused: 0,
    absent: 0,
    noTimeOut: 0,
  };
}

export function summarizeAttendanceStatuses(
  rows: AttendanceSummaryInput[]
): AttendanceCountSummary {
  const summary = emptyAttendanceSummary();

  for (const row of rows) {
    const status = row.attendance_status;
    if (status === "Present") summary.present++;
    else if (status === "Late") summary.late++;
    else if (status === "Late (Excused)") summary.lateExcused++;
    else summary.absent++;

    if (hasNoTimeOut(row.time_in, row.time_out)) {
      summary.noTimeOut++;
    }
  }

  return summary;
}
