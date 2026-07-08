import {
  AttendanceReportRow,
  SessionAttendanceRow,
} from "@/lib/attendeaseTypes";

function escapeCsvCell(value: string | number | null | undefined): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function buildCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  return [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n");
}

export function slugifyFilename(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const REPORT_HEADERS = [
  "Student #",
  "Name",
  "Department",
  "Year Level",
  "Date",
  "Session",
  "Time In",
  "Time Out",
  "Status",
] as const;

export function exportAttendanceReportRows(
  records: AttendanceReportRow[],
  filename = "attendance-report.csv"
): void {
  downloadCsv(filename, buildAttendanceReportCsv(records));
}

export function buildAttendanceReportCsv(records: AttendanceReportRow[]): string {
  const rows = records.map((record) => [
    record.student_number,
    record.student_name,
    record.department ?? "",
    record.year_level ?? "",
    record.date,
    record.session_title,
    record.time_in ?? "",
    record.time_out ?? "",
    record.attendance_status,
  ]);

  return buildCsv([...REPORT_HEADERS], rows);
}

const ROSTER_HEADERS = [
  "Student #",
  "Name",
  "Department",
  "Year Level",
  "Time In",
  "Time Out",
  "Status",
] as const;

export function exportSessionRosterRows(
  rows: SessionAttendanceRow[],
  sessionTitle: string,
  filename?: string
): void {
  const csvRows = rows.map((row) => [
    row.student_number,
    row.student_name,
    row.department ?? "",
    row.year_level ?? "",
    row.time_in ?? "",
    row.time_out ?? "",
    row.attendance_status,
  ]);

  downloadCsv(
    filename ?? `attendance-${slugifyFilename(sessionTitle) || "session"}.csv`,
    buildCsv([...ROSTER_HEADERS], csvRows)
  );
}
