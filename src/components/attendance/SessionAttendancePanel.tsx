"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { AttendanceRosterTable } from "@/components/attendance/AttendanceRosterTable";
import {
  AttendanceRosterFilters,
  useAttendanceRosterFilters,
} from "@/components/attendance/AttendanceRosterFilters";
import { SessionAttendanceRow } from "@/lib/attendeaseTypes";
import { useAttendanceRealtime, usePollingFallback } from "@/lib/hooks/useAttendanceRealtime";
import { fetchSessionAttendance } from "@/app/(admin)/sessions/actions";
import { summarizeAttendanceStatuses } from "@/lib/attendance";
import { exportSessionRosterRows, slugifyFilename } from "@/lib/export-attendance";
import { Download } from "lucide-react";

type SessionAttendancePanelProps = {
  sessionId: string;
  sessionTitle: string;
  sessionDate?: string;
};

export function SessionAttendancePanel({
  sessionId,
  sessionTitle,
  sessionDate,
}: SessionAttendancePanelProps) {
  const [rows, setRows] = useState<SessionAttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const {
    search,
    setSearch,
    yearFilter,
    setYearFilter,
    statusFilter,
    setStatusFilter,
    filteredRows,
  } = useAttendanceRosterFilters(rows);

  const loadRoster = useCallback(() => {
    startTransition(async () => {
      const result = await fetchSessionAttendance(sessionId);
      if (!result.success) {
        setError(result.error);
        setLoading(false);
        return;
      }
      setRows(result.rows);
      setError(null);
      setLoading(false);
    });
  }, [sessionId]);

  useEffect(() => {
    setLoading(true);
    loadRoster();
  }, [loadRoster]);

  useAttendanceRealtime(loadRoster, sessionId);
  usePollingFallback(loadRoster, true, 5000);

  const displaySummary = useMemo(() => {
    const summary = summarizeAttendanceStatuses(
      filteredRows.map((row) => row.attendance_status)
    );
    return {
      present: summary.present,
      onTime: summary.onTime,
      late: summary.late,
      absent: summary.absent,
    };
  }, [filteredRows]);

  if (loading && rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-text-secondary">
        Loading attendance for {sessionTitle}...
      </p>
    );
  }

  if (error) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
        {error}
      </p>
    );
  }

  function handleExport() {
    const base = sessionDate
      ? `${sessionDate}-${sessionTitle}`
      : sessionTitle;
    exportSessionRosterRows(
      filteredRows,
      sessionTitle,
      `attendance-${slugifyFilename(base)}.csv`
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <AttendanceRosterFilters
            search={search}
            onSearchChange={setSearch}
            yearFilter={yearFilter}
            onYearFilterChange={setYearFilter}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            showStatusFilter
          />
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={filteredRows.length === 0}
          className="flex shrink-0 items-center gap-2 rounded border border-maroon px-4 py-2 text-sm font-bold text-maroon disabled:opacity-60"
        >
          <Download className="size-4" />
          Export CSV
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded border border-border px-3 py-2 text-sm">
          <p className="text-text-secondary">Present</p>
          <p className="text-xl font-bold text-green-600">
            {displaySummary.present}
          </p>
        </div>
        <div className="rounded border border-border px-3 py-2 text-sm">
          <p className="text-text-secondary">On Time</p>
          <p className="text-xl font-bold text-green-600">
            {displaySummary.onTime}
          </p>
        </div>
        <div className="rounded border border-border px-3 py-2 text-sm">
          <p className="text-text-secondary">Late</p>
          <p className="text-xl font-bold text-red-500">
            {displaySummary.late}
          </p>
        </div>
        <div className="rounded border border-border px-3 py-2 text-sm">
          <p className="text-text-secondary">Absent</p>
          <p className="text-xl font-bold text-maroon">
            {displaySummary.absent}
          </p>
        </div>
      </div>

      <p className="text-xs text-text-muted">
        Present is recorded only when both time in and time out are completed.
        Showing {filteredRows.length} of {rows.length} students.
      </p>

      <AttendanceRosterTable rows={filteredRows} />
    </div>
  );
}
