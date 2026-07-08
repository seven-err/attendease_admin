"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { AttendanceReportRow } from "@/lib/attendeaseTypes";
import { DEPARTMENTS, YEAR_LEVELS } from "@/lib/constants";
import {
  ReportSessionOption,
  ReportStats,
} from "@/lib/data/report-utils";
import type { ReportsQueryParams } from "@/lib/data/reports";
import {
  formatDate,
  formatDateTimeOrDash,
  resolvedAttendanceStatusVariant,
} from "@/lib/format";
import { ExportSessionModal } from "@/components/reports/ExportSessionModal";
import { useAttendanceRealtime, usePollingFallback } from "@/lib/hooks/useAttendanceRealtime";
import { useListParams } from "@/lib/hooks/useListParams";
import type { PageSize } from "@/lib/pagination";
import { exportAttendanceReportRows } from "@/lib/export-attendance";
import { exportReports, refreshReports } from "./actions";
import { Download, Search } from "lucide-react";

type ReportsTableProps = {
  records: AttendanceReportRow[];
  page: number;
  pageSize: PageSize;
  total: number;
  totalPages: number;
  stats: ReportStats;
  sessions: ReportSessionOption[];
  recordCountBySession: Record<string, number>;
  query: ReportsQueryParams;
};

export function ReportsTable({
  records: initialRecords,
  page,
  pageSize,
  total,
  totalPages,
  stats: initialStats,
  sessions: initialSessions,
  recordCountBySession: initialRecordCountBySession,
  query,
}: ReportsTableProps) {
  const [records, setRecords] = useState(initialRecords);
  const [stats, setStats] = useState(initialStats);
  const [sessionOptions, setSessionOptions] = useState(initialSessions);
  const [recordCountBySession, setRecordCountBySession] = useState(
    initialRecordCountBySession
  );
  const [isPending, startTransition] = useTransition();
  const { searchInput, setSearchInput, setPage, setPageSize, updateParams } =
    useListParams(query.search ?? "");
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const reloadReports = useCallback(() => {
    startTransition(async () => {
      const result = await refreshReports(query);
      if (!result.success) return;
      setRecords(result.records);
      setStats(result.stats);
      setSessionOptions(result.sessions);
      setRecordCountBySession(result.recordCountBySession);
    });
  }, [query]);

  useAttendanceRealtime(reloadReports);
  usePollingFallback(reloadReports, true, 5000);

  useEffect(() => {
    setRecords(initialRecords);
    setStats(initialStats);
    setSessionOptions(initialSessions);
    setRecordCountBySession(initialRecordCountBySession);
  }, [
    initialRecords,
    initialStats,
    initialSessions,
    initialRecordCountBySession,
  ]);

  function updateFilter(
    key: "dept" | "year" | "session" | "status" | "from" | "to",
    value: string
  ) {
    updateParams({
      [key]: value === "all" ? undefined : value,
      page: "1",
    });
  }

  function exportSelectedSessions(sessionIds: string[]) {
    startTransition(async () => {
      const result = await exportReports(query, sessionIds);
      if (!result.success) return;
      exportAttendanceReportRows(result.records);
    });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold">Reports & Analytics</h2>
          <p className="text-sm text-text-secondary">
            Attendance insights and exportable records
            {isPending && " · Updating..."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExportModalOpen(true)}
          disabled={sessionOptions.length === 0}
          className="flex items-center gap-2 rounded bg-maroon px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          <Download className="size-4" />
          Export CSV
        </button>
      </div>

      <ExportSessionModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        sessions={sessionOptions}
        recordCountBySession={recordCountBySession}
        onExport={exportSelectedSessions}
      />

      <div className="flex flex-wrap items-end gap-4 rounded-[10px] border border-border bg-white p-4">
        <div className="min-w-[150px]">
          <label className="mb-1 block text-sm font-bold">From</label>
          <input
            type="date"
            value={query.fromDate}
            onChange={(event) => updateFilter("from", event.target.value)}
            className="h-10 w-full rounded border border-border px-3 text-sm outline-none"
          />
        </div>
        <div className="min-w-[150px]">
          <label className="mb-1 block text-sm font-bold">To</label>
          <input
            type="date"
            value={query.toDate}
            onChange={(event) => updateFilter("to", event.target.value)}
            className="h-10 w-full rounded border border-border px-3 text-sm outline-none"
          />
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-sm font-bold">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search student or session..."
              className="h-10 w-full rounded border border-border pl-10 pr-3 text-sm outline-none"
            />
          </div>
        </div>
        <div className="min-w-[150px]">
          <label className="mb-1 block text-sm font-bold">Department</label>
          <select
            value={query.department ?? "all"}
            onChange={(e) => updateFilter("dept", e.target.value)}
            className="h-10 w-full rounded border border-border px-3 text-sm"
          >
            <option value="all">All departments</option>
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[150px]">
          <label className="mb-1 block text-sm font-bold">Year Level</label>
          <select
            value={query.yearLevel ?? "all"}
            onChange={(e) => updateFilter("year", e.target.value)}
            className="h-10 w-full rounded border border-border px-3 text-sm"
          >
            <option value="all">All year levels</option>
            {YEAR_LEVELS.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[150px]">
          <label className="mb-1 block text-sm font-bold">Session</label>
          <select
            value={query.sessionId ?? "all"}
            onChange={(e) => updateFilter("session", e.target.value)}
            className="h-10 w-full rounded border border-border px-3 text-sm"
          >
            <option value="all">All sessions</option>
            {sessionOptions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.title}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[150px]">
          <label className="mb-1 block text-sm font-bold">Status</label>
          <select
            value={query.status ?? "all"}
            onChange={(e) => updateFilter("status", e.target.value)}
            className="h-10 w-full rounded border border-border px-3 text-sm"
          >
            <option value="all">All status</option>
            <option value="Present">Present</option>
            <option value="On Time">On Time</option>
            <option value="Late">Late</option>
            <option value="Absent">Absent</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-[10px] border border-border bg-white p-4">
          <p className="text-sm text-text-secondary">Present</p>
          <p className="mt-2 text-3xl font-bold text-green-600">
            {stats.presentPercent}%
          </p>
        </div>
        <div className="rounded-[10px] border border-border bg-white p-4">
          <p className="text-sm text-text-secondary">On Time</p>
          <p className="mt-2 text-3xl font-bold text-green-600">
            {stats.onTimePercent}%
          </p>
        </div>
        <div className="rounded-[10px] border border-border bg-white p-4">
          <p className="text-sm text-text-secondary">Late</p>
          <p className="mt-2 text-3xl font-bold text-red-500">
            {stats.latePercent}%
          </p>
        </div>
        <div className="rounded-[10px] border border-border bg-white p-4">
          <p className="text-sm text-text-secondary">Absent</p>
          <p className="mt-2 text-3xl font-bold text-maroon">
            {stats.absentPercent}%
          </p>
        </div>
        <div className="rounded-[10px] border border-border bg-white p-4">
          <p className="text-sm text-text-secondary">Total Records</p>
          <p className="mt-2 text-3xl font-bold">{stats.totalRecords}</p>
          <p className="text-xs text-text-secondary">Matching filters</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-[10px] border border-border bg-white">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 text-sm text-text-secondary">
          <span>
            {total} record{total !== 1 ? "s" : ""} in selected date range
          </span>
          <span>
            {sessionOptions.length} session{sessionOptions.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-border">
              <tr className="text-left text-[11px] font-bold uppercase text-text-secondary">
                <th className="px-4 py-3">Student #</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Year</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Session</th>
                <th className="px-4 py-3">Time In</th>
                <th className="px-4 py-3">Time Out</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-text-secondary"
                  >
                    No attendance records found for the selected filters.
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id} className="border-b border-border">
                    <td className="px-4 py-4 font-bold text-maroon">
                      {record.student_number}
                    </td>
                    <td className="px-4 py-4">{record.student_name}</td>
                    <td className="px-4 py-4">
                      {record.department ? (
                        <Badge dept={record.department}>
                          {record.department}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-4">{record.year_level ?? "—"}</td>
                    <td className="px-4 py-4 text-text-secondary">
                      {formatDate(record.date)}
                    </td>
                    <td className="px-4 py-4 text-text-secondary">
                      {record.session_title}
                    </td>
                    <td className="px-4 py-4 text-text-secondary">
                      {formatDateTimeOrDash(record.time_in)}
                    </td>
                    <td className="px-4 py-4 text-text-secondary">
                      {formatDateTimeOrDash(record.time_out)}
                    </td>
                    <td className="px-4 py-4">
                      <Badge
                        variant={resolvedAttendanceStatusVariant(
                          record.attendance_status
                        )}
                      >
                        {record.attendance_status.toUpperCase()}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          itemLabel="records"
        />
      </div>
    </div>
  );
}
