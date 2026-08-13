"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  AttendanceRosterFilters,
  useAttendanceRosterFilters,
} from "@/components/attendance/AttendanceRosterFilters";
import type { SessionAttendanceRow, SessionWithStats } from "@/lib/attendeaseTypes";
import { ATTENDANCE_STATUSES, type AttendanceStatus } from "@/lib/attendeaseTypes";
import { summarizeAttendanceStatuses } from "@/lib/attendance";
import { downloadCsv } from "@/lib/export-attendance";
import {
  displayAttendanceStatus,
  displayAttendanceStatusLabel,
  displaySessionStatus,
  formatDate,
  formatClockTimeOrDash,
  formatTimeOutDisplay,
  formatTimeRange,
  manilaDateTimeLocalToIso,
  resolvedAttendanceStatusVariant,
  sessionStatusVariant,
  toManilaDateTimeLocal,
} from "@/lib/format";
import {
  ExportModeModal,
  type ExportModeSelection,
} from "@/components/reports/ExportModeModal";
import { fetchSessionAttendance } from "@/app/(admin)/sessions/actions";
import {
  exportSessionAttendanceCsv,
  updateAttendanceLog,
  voidAttendanceLog,
} from "./actions";
import { Download, Pencil, Ban, Search } from "lucide-react";

type AttendanceManagerProps = {
  sessions: SessionWithStats[];
  canEdit: boolean;
  canVoid: boolean;
  canExport: boolean;
};

export function AttendanceManager({
  sessions,
  canEdit,
  canVoid,
  canExport,
}: AttendanceManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sessionQuery, setSessionQuery] = useState("");
  const [selectedId, setSelectedId] = useState(sessions[0]?.id ?? "");
  const [rows, setRows] = useState<SessionAttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<SessionAttendanceRow | null>(null);
  const [voidRow, setVoidRow] = useState<SessionAttendanceRow | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>("Present");
  const [editTimeIn, setEditTimeIn] = useState("");
  const [editTimeOut, setEditTimeOut] = useState("");
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const selected = useMemo(
    () => sessions.find((s) => s.id === selectedId) ?? null,
    [sessions, selectedId]
  );

  const filteredSessions = useMemo(() => {
    const q = sessionQuery.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.department ?? "").toLowerCase().includes(q) ||
        s.date.includes(q)
    );
  }, [sessions, sessionQuery]);

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

  const loadRoster = useCallback(
    (sessionId: string) => {
      if (!sessionId) {
        setRows([]);
        return;
      }
      setLoading(true);
      startTransition(async () => {
        const result = await fetchSessionAttendance(sessionId);
        if (!result.success) {
          setError(result.error);
          setRows([]);
          setLoading(false);
          return;
        }
        setRows(result.rows);
        setError(null);
        setLoading(false);
      });
    },
    []
  );

  useEffect(() => {
    if (selectedId) loadRoster(selectedId);
  }, [selectedId, loadRoster]);

  const summary = useMemo(
    () => summarizeAttendanceStatuses(summaryRows),
    [summaryRows]
  );

  function openEdit(row: SessionAttendanceRow) {
    setEditRow(row);
    const status = row.attendance_status;
    setEditStatus(
      status === "Late" ||
        status === "Late (Excused)" ||
        status === "Present" ||
        status === "Absent"
        ? status
        : "Absent"
    );
    setEditTimeIn(toManilaDateTimeLocal(row.time_in));
    setEditTimeOut(toManilaDateTimeLocal(row.time_out));
    setError(null);
  }

  function handleSaveEdit() {
    if (!editRow) return;
    setError(null);
    startTransition(async () => {
      const result = await updateAttendanceLog(editRow.id, {
        scanned_at: manilaDateTimeLocalToIso(editTimeIn),
        time_out_at: manilaDateTimeLocalToIso(editTimeOut),
        attendance_status: editStatus,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setEditRow(null);
      setSuccess(`Updated attendance for ${editRow.student_name}.`);
      loadRoster(selectedId);
      router.refresh();
    });
  }

  function handleVoid() {
    if (!voidRow) return;
    setError(null);
    startTransition(async () => {
      const result = await voidAttendanceLog(voidRow.id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setVoidRow(null);
      setSuccess(`Voided attendance for ${voidRow.student_name}.`);
      loadRoster(selectedId);
      router.refresh();
    });
  }

  async function handleExport({
    mode,
    summaryColumns,
  }: ExportModeSelection): Promise<boolean> {
    if (!selectedId) return false;
    setError(null);
    const result = await exportSessionAttendanceCsv(
      selectedId,
      statusFilter,
      mode,
      summaryColumns
    );
    if (!result.success) {
      setError(result.error);
      return false;
    }
    downloadCsv(result.filename, result.csv);
    setSuccess(
      mode === "summary"
        ? "Attendance summary CSV exported."
        : "Attendance CSV exported."
    );
    return true;
  }

  return (
    <>
      {success && (
        <Alert
          variant="success"
          onDismiss={() => setSuccess(null)}
          className="mx-auto mb-4 max-w-7xl"
        >
          {success}
        </Alert>
      )}
      {error && (
        <Alert
          variant="error"
          onDismiss={() => setError(null)}
          className="mx-auto mb-4 max-w-7xl"
        >
          {error}
        </Alert>
      )}

      <div className="mx-auto max-w-7xl space-y-4">
        <PageHeader
          title="Attendance"
          description="Review, correct, and export session attendance records"
          actions={
            canExport ? (
              <Button
                variant="secondary"
                onClick={() => setExportModalOpen(true)}
                disabled={isPending || !selectedId}
              >
                <Download className="size-4" />
                Export CSV
              </Button>
            ) : null
          }
        />

        <ExportModeModal
          open={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          onExport={handleExport}
          disabled={!selectedId || filteredRows.length === 0}
          recordCount={filteredRows.length}
        />

        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="card overflow-hidden">
            <div className="card-header">
              <h3 className="font-bold">Sessions</h3>
            </div>
            <div className="border-b border-border p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
                <input
                  type="search"
                  value={sessionQuery}
                  onChange={(e) => setSessionQuery(e.target.value)}
                  placeholder="Filter sessions..."
                  className="input-field pl-10"
                />
              </div>
            </div>
            <div className="max-h-[70vh] overflow-auto">
              {filteredSessions.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-text-secondary">
                  No sessions found.
                </p>
              ) : (
                filteredSessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => setSelectedId(session.id)}
                    className={`block w-full border-b border-border-subtle px-4 py-3 text-left transition ${
                      selectedId === session.id
                        ? "bg-maroon-light"
                        : "hover:bg-header-bg"
                    }`}
                  >
                    <div className="mb-1 flex flex-wrap gap-2">
                      <Badge variant={sessionStatusVariant(session.status)}>
                        {displaySessionStatus(session.status)}
                      </Badge>
                      {session.department && (
                        <Badge dept={session.department}>
                          {session.department}
                        </Badge>
                      )}
                    </div>
                    <p className="font-bold">{session.title}</p>
                    <p className="text-xs text-text-secondary">
                      {formatDate(session.date)} ·{" "}
                      {formatTimeRange(session.start_time, session.end_time)}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="card space-y-4 p-4">
            {selected ? (
              <>
                <div>
                  <h3 className="text-lg font-bold">{selected.title}</h3>
                  <p className="text-sm text-text-secondary">
                    {formatDate(selected.date)} ·{" "}
                    {formatTimeRange(selected.start_time, selected.end_time)}
                  </p>
                </div>

                <AttendanceRosterFilters
                  search={search}
                  onSearchChange={setSearch}
                  yearFilter={yearFilter}
                  onYearFilterChange={setYearFilter}
                  statusFilter={statusFilter}
                  onStatusFilterChange={setStatusFilter}
                  showStatusFilter
                />

                <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
                  <div className="min-w-0 rounded border border-border px-3 py-2 text-sm">
                    <p className="truncate text-text-secondary">Present</p>
                    <p className="text-xl font-bold tabular-nums text-green-600">
                      {summary.present}
                    </p>
                  </div>
                  <div className="min-w-0 rounded border border-border px-3 py-2 text-sm">
                    <p className="truncate text-text-secondary">Late</p>
                    <p className="text-xl font-bold tabular-nums text-red-500">
                      {summary.late}
                    </p>
                  </div>
                  <div className="min-w-0 rounded border border-border px-3 py-2 text-sm">
                    <p className="truncate text-text-secondary">Late (Excused)</p>
                    <p className="text-xl font-bold tabular-nums text-amber-700">
                      {summary.lateExcused}
                    </p>
                  </div>
                  <div className="min-w-0 rounded border border-border px-3 py-2 text-sm">
                    <p className="truncate text-text-secondary">Absent</p>
                    <p className="text-xl font-bold tabular-nums text-maroon">
                      {summary.absent}
                    </p>
                  </div>
                  <div className="col-span-2 min-w-0 rounded border border-border px-3 py-2 text-sm lg:col-span-1">
                    <p className="truncate text-text-secondary">No Time Out</p>
                    <p className="text-xl font-bold tabular-nums text-text-secondary">
                      {summary.noTimeOut}
                    </p>
                  </div>
                </div>

                {loading && rows.length === 0 ? (
                  <p className="py-8 text-center text-sm text-text-secondary">
                    Loading roster...
                  </p>
                ) : (
                  <div className="max-h-[55vh] overflow-auto rounded border border-border">
                    <table className="w-full min-w-[820px] text-sm">
                      <thead className="sticky top-0 border-b border-border bg-header-bg">
                        <tr className="text-left text-[11px] font-bold uppercase text-text-secondary">
                          <th className="px-4 py-3">Student #</th>
                          <th className="px-4 py-3">Name</th>
                          <th className="px-4 py-3">Time In</th>
                          <th className="px-4 py-3">Time Out</th>
                          <th className="px-4 py-3">Scan By</th>
                          <th className="px-4 py-3">Status</th>
                          {(canEdit || canVoid) && (
                            <th className="px-4 py-3 text-right">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={canEdit || canVoid ? 7 : 6}
                              className="px-4 py-8 text-center text-text-secondary"
                            >
                              No students match filters.
                            </td>
                          </tr>
                        ) : (
                          filteredRows.map((row) => {
                            const hasLog = !row.id.startsWith("absent-");
                            const isVoided = row.attendance_status === "Voided";
                            return (
                              <tr
                                key={row.id}
                                className="border-b border-border"
                              >
                                <td className="px-4 py-3 font-mono">
                                  {row.student_number}
                                </td>
                                <td className="px-4 py-3 font-bold">
                                  {row.student_name}
                                </td>
                                <td className="px-4 py-3 text-text-secondary">
                                  {formatClockTimeOrDash(row.time_in)}
                                </td>
                                <td className="px-4 py-3 text-text-secondary">
                                  {formatTimeOutDisplay(row.time_in, row.time_out)}
                                </td>
                                <td className="px-4 py-3 text-text-secondary">
                                  {row.scan_by ?? "—"}
                                </td>
                                <td className="px-4 py-3">
                                  <Badge
                                    variant={resolvedAttendanceStatusVariant(
                                      row.attendance_status
                                    )}
                                  >
                                    {displayAttendanceStatus(row.attendance_status)}
                                  </Badge>
                                </td>
                                {(canEdit || canVoid) && (
                                  <td className="px-4 py-3 text-right">
                                    <div className="flex justify-end gap-1">
                                      {canEdit && hasLog && !isVoided && (
                                        <button
                                          type="button"
                                          className="btn-icon"
                                          aria-label={`Edit ${row.student_name}`}
                                          onClick={() => openEdit(row)}
                                          disabled={isPending}
                                        >
                                          <Pencil className="size-4" />
                                        </button>
                                      )}
                                      {canVoid && hasLog && !isVoided && (
                                        <button
                                          type="button"
                                          className="btn-icon text-maroon"
                                          aria-label={`Void ${row.student_name}`}
                                          onClick={() => setVoidRow(row)}
                                          disabled={isPending}
                                        >
                                          <Ban className="size-4" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <p className="py-12 text-center text-sm text-text-secondary">
                Select a session to view attendance.
              </p>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={Boolean(editRow)}
        onClose={() => !isPending && setEditRow(null)}
        title="Edit attendance"
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={isPending}
              onClick={() => setEditRow(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isPending}
              onClick={handleSaveEdit}
            >
              {isPending ? "Saving..." : "Save changes"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">
            Correcting{" "}
            <span className="font-bold text-foreground">
              {editRow?.student_name}
            </span>
          </p>
          <div>
            <label className="label-field-sm">Status</label>
            <select
              className="select-field w-full"
              value={editStatus}
              onChange={(e) =>
                setEditStatus(e.target.value as AttendanceStatus)
              }
            >
              {ATTENDANCE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {displayAttendanceStatusLabel(status)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field-sm">Time in</label>
            <input
              type="datetime-local"
              className="input-field w-full"
              value={editTimeIn}
              onChange={(e) => setEditTimeIn(e.target.value)}
            />
          </div>
          <div>
            <label className="label-field-sm">Time out</label>
            <input
              type="datetime-local"
              className="input-field w-full"
              value={editTimeOut}
              onChange={(e) => setEditTimeOut(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(voidRow)}
        onClose={() => !isPending && setVoidRow(null)}
        title="Void attendance record?"
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={isPending}
              onClick={() => setVoidRow(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isPending}
              onClick={handleVoid}
            >
              {isPending ? "Voiding..." : "Yes, void record"}
            </button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          This marks the attendance log for{" "}
          <span className="font-bold text-foreground">
            {voidRow?.student_name}
          </span>{" "}
          as voided. The action is audited and cannot be undone from this
          screen.
        </p>
      </Modal>
    </>
  );
}
