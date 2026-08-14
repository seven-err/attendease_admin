"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { AttendanceRosterTable } from "@/components/attendance/AttendanceRosterTable";
import {
  AttendanceRosterFilters,
  useAttendanceRosterFilters,
} from "@/components/attendance/AttendanceRosterFilters";
import {
  ExportModeModal,
  type ExportModeSelection,
} from "@/components/reports/ExportModeModal";
import { SessionAttendanceRow, PenaltySessionContext } from "@/lib/attendeaseTypes";
import {
  FALLBACK_POLL_MS,
  useAttendanceRealtime,
  usePollingFallback,
} from "@/lib/hooks/useAttendanceRealtime";
import { fetchSessionAttendance } from "@/app/(admin)/sessions/actions";
import { summarizeAttendanceStatuses } from "@/lib/attendance";
import { exportSessionRosterRows } from "@/lib/export-attendance";
import {
  assessRecordPenalty,
  formatPenaltyRatesSummary,
  formatPeso,
  penaltyContextFromSession,
  sumFinalizedPenalties,
} from "@/lib/penalties";
import { Download } from "lucide-react";

type SessionAttendancePanelProps = {
  sessionId: string;
  sessionTitle: string;
  sessionDate?: string;
  mainSessionName?: string | null;
  sessionPenalties?: PenaltySessionContext | null;
};

export function SessionAttendancePanel({
  sessionId,
  sessionTitle,
  sessionDate,
  mainSessionName,
  sessionPenalties = null,
}: SessionAttendancePanelProps) {
  const [rows, setRows] = useState<SessionAttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [, startTransition] = useTransition();

  const {
    search,
    setSearch,
    yearFilter,
    setYearFilter,
    statusFilter,
    setStatusFilter,
    summaryRows,
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

  const { realtimeReady } = useAttendanceRealtime(loadRoster, sessionId);
  usePollingFallback(loadRoster, realtimeReady === false, FALLBACK_POLL_MS);

  const displaySummary = useMemo(
    () => summarizeAttendanceStatuses(summaryRows),
    [summaryRows]
  );

  const normalizedPenalties = useMemo(
    () => (sessionPenalties ? penaltyContextFromSession(sessionPenalties) : null),
    [sessionPenalties]
  );

  const penaltyTotal = useMemo(
    () =>
      sumFinalizedPenalties(
        filteredRows.map((row) =>
          assessRecordPenalty({
            time_in: row.time_in,
            time_out: row.time_out,
            attendance_status: row.attendance_status,
            person_kind: row.person_kind,
            session_penalties: normalizedPenalties ?? undefined,
          })
        )
      ),
    [filteredRows, normalizedPenalties]
  );

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

  function handleExport({ mode, summaryColumns }: ExportModeSelection) {
    exportSessionRosterRows(filteredRows, sessionTitle, {
      mainSessionName,
      date: sessionDate,
      statusFilter,
      exportMode: mode,
      summaryColumns,
      sessionPenalties: normalizedPenalties,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
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
          onClick={() => setExportModalOpen(true)}
          disabled={filteredRows.length === 0}
          className="flex w-full shrink-0 items-center justify-center gap-2 rounded border border-maroon px-4 py-2 text-sm font-bold text-maroon disabled:opacity-60 sm:w-auto"
        >
          <Download className="size-4" />
          Export CSV
        </button>
      </div>

      <ExportModeModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExport={handleExport}
        disabled={filteredRows.length === 0}
        recordCount={filteredRows.length}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <div className="min-w-0 overflow-hidden rounded border border-border px-3 py-2 text-sm">
          <p className="truncate text-text-secondary">Present</p>
          <p className="text-xl font-bold tabular-nums text-green-600">
            {displaySummary.present}
          </p>
        </div>
        <div className="min-w-0 overflow-hidden rounded border border-border px-3 py-2 text-sm">
          <p className="truncate text-text-secondary">Late</p>
          <p className="text-xl font-bold tabular-nums text-red-500">
            {displaySummary.late}
          </p>
        </div>
        <div className="min-w-0 overflow-hidden rounded border border-border px-3 py-2 text-sm">
          <p className="truncate text-text-secondary">Late (Excused)</p>
          <p className="text-xl font-bold tabular-nums text-amber-700">
            {displaySummary.lateExcused}
          </p>
        </div>
        <div className="min-w-0 overflow-hidden rounded border border-border px-3 py-2 text-sm">
          <p className="truncate text-text-secondary">Absent</p>
          <p className="text-xl font-bold tabular-nums text-maroon">
            {displaySummary.absent}
          </p>
        </div>
        <div className="min-w-0 overflow-hidden rounded border border-border px-3 py-2 text-sm">
          <p className="truncate text-text-secondary">No Time Out</p>
          <p className="text-xl font-bold tabular-nums text-text-secondary">
            {displaySummary.noTimeOut}
          </p>
        </div>
        <div className="min-w-0 overflow-hidden rounded border border-border px-3 py-2 text-sm">
          <p className="truncate text-text-secondary">No Time In</p>
          <p className="text-xl font-bold tabular-nums text-text-secondary">
            {displaySummary.noTimeIn}
          </p>
        </div>
        <div className="min-w-0 overflow-hidden rounded border border-border px-3 py-2 text-sm sm:col-span-2 lg:col-span-2">
          <p className="truncate text-text-secondary">Penalties</p>
          <p className="truncate text-xl font-bold tabular-nums text-maroon">
            {formatPeso(penaltyTotal)}
          </p>
        </div>
      </div>

      {normalizedPenalties && (
        <p className="text-xs text-text-muted">
          Rates:{" "}
          {formatPenaltyRatesSummary({
            latePhp: normalizedPenalties.penalty_late_php,
            absentPhp: normalizedPenalties.penalty_absent_php,
            incompletePhp: normalizedPenalties.penalty_incomplete_php,
          })}
        </p>
      )}

      <p className="text-xs text-text-muted">
        Present means timed in on time (with or without time out). Time Out
        without Time In is No Time In, not Absent. Showing{" "}
        {filteredRows.length} of {rows.length} students.
      </p>

      <AttendanceRosterTable
        rows={filteredRows}
        sessionPenalties={normalizedPenalties}
      />
    </div>
  );
}
