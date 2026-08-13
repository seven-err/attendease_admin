import { summarizeAttendanceStatuses } from "@/lib/attendance";
import { AttendanceReportRow } from "@/lib/attendeaseTypes";

export type ReportStats = {
  presentPercent: number;
  latePercent: number;
  lateExcusedPercent: number;
  absentPercent: number;
  noTimeOutPercent: number;
  totalRecords: number;
};

export type ReportSessionOption = {
  id: string;
  title: string;
  date: string;
  department: string | null;
};

export function buildReportStats(records: AttendanceReportRow[]): ReportStats {
  const total = records.length;
  if (total === 0) {
    return {
      presentPercent: 0,
      latePercent: 0,
      lateExcusedPercent: 0,
      absentPercent: 0,
      noTimeOutPercent: 0,
      totalRecords: 0,
    };
  }

  const summary = summarizeAttendanceStatuses(records);

  return {
    presentPercent: Math.round((summary.present / total) * 100),
    latePercent: Math.round((summary.late / total) * 100),
    lateExcusedPercent: Math.round((summary.lateExcused / total) * 100),
    absentPercent: Math.round((summary.absent / total) * 100),
    noTimeOutPercent: Math.round((summary.noTimeOut / total) * 100),
    totalRecords: total,
  };
}
