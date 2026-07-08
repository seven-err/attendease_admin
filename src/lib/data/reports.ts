import { AttendanceReportRow } from "@/lib/attendeaseTypes";
import { getSessionAttendanceRoster } from "@/lib/data/session-attendance";
import {
  buildPaginatedResult,
  getRange,
  parsePageParam,
  parsePageSizeParam,
  parseSearchParam,
  type PaginatedResult,
} from "@/lib/pagination";
import {
  buildReportStats,
  ReportSessionOption,
  ReportStats,
} from "@/lib/data/report-utils";
import { addDaysToDateString, todayDateString } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export type { ReportSessionOption, ReportStats };
export { buildReportStats };

export type ReportsQueryParams = {
  page: number;
  pageSize: number;
  search?: string;
  fromDate: string;
  toDate: string;
  department?: string;
  yearLevel?: string;
  sessionId?: string;
  status?: string;
};

export type ReportsPageData = {
  records: AttendanceReportRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: ReportStats;
  sessions: ReportSessionOption[];
  recordCountBySession: Record<string, number>;
};

export function getDefaultReportDateRange(): { from: string; to: string } {
  const to = todayDateString();
  return {
    from: addDaysToDateString(to, -30),
    to,
  };
}

export function parseReportDateParam(
  value: string | string[] | undefined
): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  return raw;
}

export function resolveReportDateRange(
  fromDate?: string,
  toDate?: string
): { fromDate: string; toDate: string } {
  const defaults = getDefaultReportDateRange();
  const from = fromDate ?? defaults.from;
  const to = toDate ?? defaults.to;

  if (from > to) {
    return { fromDate: to, toDate: from };
  }

  return { fromDate: from, toDate: to };
}

async function getSessionsForReports(
  params: Pick<
    ReportsQueryParams,
    "fromDate" | "toDate" | "sessionId" | "department"
  >
): Promise<ReportSessionOption[]> {
  const supabase = await createClient();

  let query = supabase
    .from("attendance_sessions")
    .select("id, title, date, department")
    .in("status", ["Open", "Closed", "Archived"])
    .gte("date", params.fromDate)
    .lte("date", params.toDate)
    .order("date", { ascending: false })
    .order("start_time", { ascending: false });

  if (params.sessionId && params.sessionId !== "all") {
    query = query.eq("id", params.sessionId);
  }

  if (params.department && params.department !== "all") {
    query = query.eq("department", params.department);
  }

  const { data, error } = await query;

  if (error || !data) return [];
  return data;
}

async function buildAttendanceReportRows(
  sessions: ReportSessionOption[]
): Promise<AttendanceReportRow[]> {
  const records: AttendanceReportRow[] = [];

  for (const session of sessions) {
    const roster = await getSessionAttendanceRoster(session.id);
    for (const row of roster) {
      records.push({
        id: `${session.id}-${row.student_id}`,
        session_id: session.id,
        student_number: row.student_number,
        student_name: row.student_name,
        department: row.department ?? session.department,
        date: session.date,
        session_title: session.title,
        year_level: row.year_level,
        time_in: row.time_in,
        time_out: row.time_out,
        attendance_status: row.attendance_status,
      });
    }
  }

  return records;
}

function applyReportFilters(
  records: AttendanceReportRow[],
  params: ReportsQueryParams
): AttendanceReportRow[] {
  let list = records;

  if (params.department && params.department !== "all") {
    list = list.filter((record) => record.department === params.department);
  }

  if (params.yearLevel && params.yearLevel !== "all") {
    list = list.filter((record) => record.year_level === params.yearLevel);
  }

  if (params.sessionId && params.sessionId !== "all") {
    list = list.filter((record) => record.session_id === params.sessionId);
  }

  if (params.status && params.status !== "all") {
    list = list.filter(
      (record) => record.attendance_status === params.status
    );
  }

  const query = params.search?.trim().toLowerCase() ?? "";
  if (query) {
    list = list.filter(
      (record) =>
        record.student_number.toLowerCase().includes(query) ||
        record.student_name.toLowerCase().includes(query) ||
        record.session_title.toLowerCase().includes(query)
    );
  }

  return list;
}

function countRecordsBySession(
  records: AttendanceReportRow[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const record of records) {
    counts[record.session_id] = (counts[record.session_id] ?? 0) + 1;
  }
  return counts;
}

export async function getReportsPageData(
  params: ReportsQueryParams
): Promise<ReportsPageData> {
  const sessions = await getSessionsForReports(params);
  const allRecords = await buildAttendanceReportRows(sessions);
  const filtered = applyReportFilters(allRecords, params);
  const total = filtered.length;
  const { from, to } = getRange(params.page, params.pageSize);
  const pageItems = filtered.slice(from, to + 1);
  const paginated = buildPaginatedResult(
    pageItems,
    total,
    params.page,
    params.pageSize
  );

  const recordsWithoutSessionFilter = applyReportFilters(allRecords, {
    ...params,
    sessionId: "all",
  });

  return {
    records: paginated.items,
    total: paginated.total,
    page: paginated.page,
    pageSize: paginated.pageSize,
    totalPages: paginated.totalPages,
    stats: buildReportStats(filtered),
    sessions,
    recordCountBySession: countRecordsBySession(recordsWithoutSessionFilter),
  };
}

export async function getFilteredReportRecordsForExport(
  params: ReportsQueryParams,
  sessionIds: string[]
): Promise<AttendanceReportRow[]> {
  const sessions = await getSessionsForReports({
    fromDate: params.fromDate,
    toDate: params.toDate,
    sessionId: params.sessionId,
    department: params.department,
  });

  const selected = new Set(sessionIds);
  const targetSessions =
    sessionIds.length > 0
      ? sessions.filter((session) => selected.has(session.id))
      : sessions;

  const allRecords = await buildAttendanceReportRows(targetSessions);
  const filtered = applyReportFilters(allRecords, {
    ...params,
    sessionId: "all",
  });

  if (sessionIds.length === 0) {
    return filtered;
  }

  return filtered.filter((record) => selected.has(record.session_id));
}

export async function getReportSessions(
  fromDate?: string,
  toDate?: string
): Promise<ReportSessionOption[]> {
  const range = resolveReportDateRange(fromDate, toDate);
  return getSessionsForReports({
    fromDate: range.fromDate,
    toDate: range.toDate,
  });
}

export async function getFullAttendanceReports(
  fromDate?: string,
  toDate?: string
): Promise<AttendanceReportRow[]> {
  const range = resolveReportDateRange(fromDate, toDate);
  const sessions = await getSessionsForReports({
    fromDate: range.fromDate,
    toDate: range.toDate,
  });
  return buildAttendanceReportRows(sessions);
}

export async function getReportStats(
  fromDate?: string,
  toDate?: string
): Promise<ReportStats> {
  const records = await getFullAttendanceReports(fromDate, toDate);
  return buildReportStats(records);
}

export async function getAttendanceReportsPaginated(
  params: ReportsQueryParams
): Promise<PaginatedResult<AttendanceReportRow>> {
  const data = await getReportsPageData(params);
  return {
    items: data.records,
    total: data.total,
    page: data.page,
    pageSize: data.pageSize,
    totalPages: data.totalPages,
  };
}

function parseFilterParam(
  value: string | string[] | undefined,
  fallback = "all"
): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() || fallback;
}

export function buildReportsQueryParams(
  searchParams: Record<string, string | string[] | undefined>
): ReportsQueryParams {
  const dates = resolveReportDateRange(
    parseReportDateParam(searchParams.from),
    parseReportDateParam(searchParams.to)
  );

  return {
    page: parsePageParam(searchParams.page),
    pageSize: parsePageSizeParam(searchParams.pageSize),
    search: parseSearchParam(searchParams.q),
    fromDate: dates.fromDate,
    toDate: dates.toDate,
    department: parseFilterParam(searchParams.dept),
    yearLevel: parseFilterParam(searchParams.year),
    sessionId: parseFilterParam(searchParams.session),
    status: parseFilterParam(searchParams.status),
  };
}
