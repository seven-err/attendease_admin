import {
  AttendanceReportRow,
  SessionAttendanceRow,
} from "@/lib/attendeaseTypes";
import { hasNoTimeOut } from "@/lib/attendance";
import { formatDateTime } from "@/lib/format";

function escapeCsvCell(value: string | number | null | undefined): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function buildCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  return [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n");
}

/** Format stored UTC timestamps as Philippine wall-clock for CSV export. */
function exportPhDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return formatDateTime(iso);
}

/** Time Out CSV cell: "No Time Out" when timed in without time out. */
export function exportTimeOutCell(
  timeIn: string | null | undefined,
  timeOut: string | null | undefined
): string {
  if (timeOut) return exportPhDateTime(timeOut);
  if (timeIn) return "No Time Out";
  return "";
}

export function slugifyFilename(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Keep names readable while removing characters unsafe in file names. */
function sanitizeFilenamePart(value: string): string {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export type AttendanceExportMode = "detailed" | "summary";

export type AttendanceExportFilenameInput = {
  mainSessionName?: string | null;
  sessionTitle: string;
  date: string;
  /** Selected attendance status filter; "all" or omitted → status(All). */
  statusFilter?: string | null;
  /** detailed | summary — included in filename when provided. */
  exportMode?: AttendanceExportMode | null;
};

/**
 * Example: ASEAN & NOVELTY Practice(9th Day Practice)-2026-08-13-status(Present).csv
 * Summary: ASEAN Practice-2026-08-13-summary-status(All).csv
 */
export function buildAttendanceExportFilename(
  input: AttendanceExportFilenameInput
): string {
  const sessionName =
    sanitizeFilenamePart(input.sessionTitle) || "session";
  const datePart = sanitizeFilenamePart(input.date) || "undated";
  const picked =
    input.statusFilter && input.statusFilter !== "all"
      ? sanitizeFilenamePart(input.statusFilter)
      : "All";
  const statusPart = `status(${picked})`;
  const modePart =
    input.exportMode === "summary"
      ? "summary"
      : input.exportMode === "detailed"
        ? "detailed"
        : "";

  const mainName = input.mainSessionName
    ? sanitizeFilenamePart(input.mainSessionName)
    : "";

  const base = mainName
    ? `${mainName}(${sessionName})-${datePart}`
    : `${sessionName}-${datePart}`;

  const withMode = modePart ? `${base}-${modePart}` : base;
  return `${withMode}-${statusPart}.csv`;
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
  "Time In (PHT)",
  "Time Out (PHT)",
  "Scan By",
  "Status",
] as const;

export function exportAttendanceReportRows(
  records: AttendanceReportRow[],
  filename = "attendance-report-detailed.csv"
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
    exportPhDateTime(record.time_in),
    exportTimeOutCell(record.time_in, record.time_out),
    record.scan_by ?? "",
    record.attendance_status,
  ]);

  return buildCsv([...REPORT_HEADERS], rows);
}

export type AttendanceSummaryExportRow = {
  student_number: string;
  student_name: string;
  department: string | null;
  year_level: string | null;
  present: number;
  late: number;
  lateExcused: number;
  noTimeOut: number;
  absent: number;
  totalSessions: number;
};

/** Selectable summary CSV count columns (multi-select on export). */
export const SUMMARY_STATUS_COLUMNS = [
  "Present",
  "Late",
  "Late (Excused)",
  "No Time Out",
  "Absent",
] as const;

export type SummaryStatusColumn = (typeof SUMMARY_STATUS_COLUMNS)[number];

export const DEFAULT_SUMMARY_STATUS_COLUMNS: SummaryStatusColumn[] = [
  ...SUMMARY_STATUS_COLUMNS,
];

const SUMMARY_COLUMN_META: Record<
  SummaryStatusColumn,
  { header: string; value: (row: AttendanceSummaryExportRow) => number }
> = {
  Present: { header: "Present", value: (row) => row.present },
  Late: { header: "Late", value: (row) => row.late },
  "Late (Excused)": {
    header: "Late (Excused)",
    value: (row) => row.lateExcused,
  },
  "No Time Out": { header: "No Time Out", value: (row) => row.noTimeOut },
  Absent: { header: "Absent", value: (row) => row.absent },
};

export function normalizeSummaryStatusColumns(
  columns?: SummaryStatusColumn[] | null
): SummaryStatusColumn[] {
  if (!columns?.length) return [...DEFAULT_SUMMARY_STATUS_COLUMNS];
  const allowed = new Set<string>(SUMMARY_STATUS_COLUMNS);
  const unique: SummaryStatusColumn[] = [];
  for (const column of columns) {
    if (!allowed.has(column)) continue;
    if (!unique.includes(column)) unique.push(column);
  }
  return unique.length > 0 ? unique : [...DEFAULT_SUMMARY_STATUS_COLUMNS];
}

export type AttendanceSummaryCsvOptions = {
  /**
   * Total Sessions is only meaningful when rolling up multiple sub-sessions
   * (e.g. a main session export). Defaults to true when records span >1 session.
   */
  includeTotalSessions?: boolean;
  /** Which status count columns to include. Defaults to all. */
  summaryColumns?: SummaryStatusColumn[];
};

export function shouldIncludeTotalSessions(
  records: AttendanceReportRow[]
): boolean {
  const sessionIds = new Set(
    records.map((record) => record.session_id).filter(Boolean)
  );
  return sessionIds.size > 1;
}

export function buildAttendanceSummaryRows(
  records: AttendanceReportRow[]
): AttendanceSummaryExportRow[] {
  const byStudent = new Map<string, AttendanceSummaryExportRow>();

  for (const record of records) {
    const key = record.student_number;
    let row = byStudent.get(key);
    if (!row) {
      row = {
        student_number: record.student_number,
        student_name: record.student_name,
        department: record.department,
        year_level: record.year_level,
        present: 0,
        late: 0,
        lateExcused: 0,
        noTimeOut: 0,
        absent: 0,
        totalSessions: 0,
      };
      byStudent.set(key, row);
    }

    row.totalSessions++;
    const status = record.attendance_status;
    if (status === "Present") row.present++;
    else if (status === "Late") row.late++;
    else if (status === "Late (Excused)") row.lateExcused++;
    else row.absent++;

    if (hasNoTimeOut(record.time_in, record.time_out)) {
      row.noTimeOut++;
    }
  }

  return [...byStudent.values()].sort((a, b) =>
    a.student_number.localeCompare(b.student_number)
  );
}

export function buildAttendanceSummaryCsv(
  records: AttendanceReportRow[],
  options?: AttendanceSummaryCsvOptions
): string {
  const includeTotalSessions =
    options?.includeTotalSessions ?? shouldIncludeTotalSessions(records);
  const summaryColumns = normalizeSummaryStatusColumns(options?.summaryColumns);

  const headers = [
    "Student #",
    "Name",
    "Department",
    "Year Level",
    ...summaryColumns.map((column) => SUMMARY_COLUMN_META[column].header),
    ...(includeTotalSessions ? ["Total Sessions"] : []),
  ];

  const summaryRows = buildAttendanceSummaryRows(records);
  const rows = summaryRows.map((row) => [
    row.student_number,
    row.student_name,
    row.department ?? "",
    row.year_level ?? "",
    ...summaryColumns.map((column) => SUMMARY_COLUMN_META[column].value(row)),
    ...(includeTotalSessions ? [row.totalSessions] : []),
  ]);
  return buildCsv(headers, rows);
}

export function exportAttendanceSummaryRows(
  records: AttendanceReportRow[],
  filename = "attendance-report-summary.csv",
  options?: AttendanceSummaryCsvOptions
): void {
  downloadCsv(filename, buildAttendanceSummaryCsv(records, options));
}

const ROSTER_HEADERS = [
  "Student #",
  "Name",
  "Department",
  "Year Level",
  "Time In (PHT)",
  "Time Out (PHT)",
  "Scan By",
  "Status",
] as const;

function resolveSessionExportMeta(
  sessionTitle: string,
  filenameOrMeta?:
    | string
    | {
        mainSessionName?: string | null;
        date?: string;
        statusFilter?: string | null;
        filename?: string;
        exportMode?: AttendanceExportMode;
      },
  defaultMode: AttendanceExportMode = "detailed"
): { filename: string; exportMode: AttendanceExportMode } {
  if (typeof filenameOrMeta === "string") {
    return { filename: filenameOrMeta, exportMode: defaultMode };
  }

  const exportMode = filenameOrMeta?.exportMode ?? defaultMode;
  return {
    exportMode,
    filename:
      filenameOrMeta?.filename ??
      buildAttendanceExportFilename({
        mainSessionName: filenameOrMeta?.mainSessionName,
        sessionTitle,
        date: filenameOrMeta?.date ?? "",
        statusFilter: filenameOrMeta?.statusFilter,
        exportMode,
      }),
  };
}

function sessionRowsToReportRows(
  rows: SessionAttendanceRow[],
  sessionTitle: string,
  date = ""
): AttendanceReportRow[] {
  return rows.map((row) => ({
    id: row.id,
    session_id: "",
    student_number: row.student_number,
    student_name: row.student_name,
    department: row.department,
    date,
    session_title: sessionTitle,
    year_level: row.year_level,
    time_in: row.time_in,
    time_out: row.time_out,
    scan_by: row.scan_by,
    attendance_status: row.attendance_status,
  }));
}

export function exportSessionRosterRows(
  rows: SessionAttendanceRow[],
  sessionTitle: string,
  filenameOrMeta?:
    | string
    | {
        mainSessionName?: string | null;
        date?: string;
        statusFilter?: string | null;
        filename?: string;
        exportMode?: AttendanceExportMode;
        summaryColumns?: SummaryStatusColumn[];
      }
): void {
  const { filename, exportMode } = resolveSessionExportMeta(
    sessionTitle,
    filenameOrMeta
  );

  if (exportMode === "summary") {
    const date =
      typeof filenameOrMeta === "string" ? "" : (filenameOrMeta?.date ?? "");
    const summaryColumns =
      typeof filenameOrMeta === "string"
        ? undefined
        : filenameOrMeta?.summaryColumns;
    downloadCsv(
      filename,
      buildAttendanceSummaryCsv(
        sessionRowsToReportRows(rows, sessionTitle, date),
        { includeTotalSessions: false, summaryColumns }
      )
    );
    return;
  }

  const csvRows = rows.map((row) => [
    row.student_number,
    row.student_name,
    row.department ?? "",
    row.year_level ?? "",
    exportPhDateTime(row.time_in),
    exportTimeOutCell(row.time_in, row.time_out),
    row.scan_by ?? "",
    row.attendance_status,
  ]);

  downloadCsv(filename, buildCsv([...ROSTER_HEADERS], csvRows));
}
