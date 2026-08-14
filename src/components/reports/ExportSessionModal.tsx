"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { SummaryStatusPicker } from "@/components/reports/SummaryStatusPicker";
import { ReportSessionOption } from "@/lib/data/report-utils";
import {
  type AttendanceExportMode,
  type SummaryStatusColumn,
} from "@/lib/export-attendance";
import { formatDate } from "@/lib/format";
import { Download, Loader2 } from "lucide-react";

export type ExportSessionSelection = {
  sessionIds: string[];
  mode: AttendanceExportMode;
  summaryColumns: SummaryStatusColumn[];
};

type ExportSessionModalProps = {
  open: boolean;
  onClose: () => void;
  sessions: ReportSessionOption[];
  recordCountBySession: Record<string, number>;
  /** Return false (or throw) to keep the modal open after a failed export. */
  onExport: (
    selection: ExportSessionSelection
  ) => boolean | void | Promise<boolean | void>;
};

export function ExportSessionModal({
  open,
  onClose,
  sessions,
  recordCountBySession,
  onExport,
}: ExportSessionModalProps) {
  const allSessionIds = useMemo(
    () => sessions.map((session) => session.id),
    [sessions]
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(allSessionIds);
  const [exportMode, setExportMode] =
    useState<AttendanceExportMode>("detailed");
  const [summaryColumns, setSummaryColumns] = useState<SummaryStatusColumn[]>(
    []
  );
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedIds(allSessionIds);
      setExportMode("detailed");
      setSummaryColumns([]);
      setExporting(false);
    }
  }, [open, allSessionIds]);

  const allSelected =
    sessions.length > 0 && selectedIds.length === sessions.length;
  const selectedCount = selectedIds.length;

  const exportableCount = useMemo(
    () =>
      selectedIds.reduce(
        (total, sessionId) => total + (recordCountBySession[sessionId] ?? 0),
        0
      ),
    [recordCountBySession, selectedIds]
  );

  const summaryReady =
    exportMode !== "summary" || summaryColumns.length > 0;

  function toggleSession(sessionId: string) {
    setSelectedIds((current) =>
      current.includes(sessionId)
        ? current.filter((id) => id !== sessionId)
        : [...current, sessionId]
    );
  }

  function toggleAll() {
    setSelectedIds(allSelected ? [] : allSessionIds);
  }

  async function handleExport() {
    if (selectedIds.length === 0 || !summaryReady || exporting) return;
    setExporting(true);
    try {
      const result = await onExport({
        sessionIds: selectedIds,
        mode: exportMode,
        summaryColumns,
      });
      if (result === false) return;
      onClose();
    } catch {
      // Keep modal open so the user can retry after seeing the error.
    } finally {
      setExporting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!exporting) onClose();
      }}
      title="Export Attendance"
      panelClassName="max-w-lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="px-4 py-2 text-sm font-bold text-foreground disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={
              selectedCount === 0 ||
              exportableCount === 0 ||
              !summaryReady ||
              exporting
            }
            className="flex items-center gap-2 rounded bg-maroon px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {exporting
              ? "Exporting..."
              : exportMode === "summary"
                ? "Export summary"
                : `Export ${exportableCount} record${exportableCount !== 1 ? "s" : ""}`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {exporting && (
          <div className="flex items-center gap-3 rounded border border-maroon/20 bg-maroon-light px-3 py-3 text-sm text-maroon">
            <Loader2 className="size-5 shrink-0 animate-spin" />
            <span className="font-bold">Preparing your CSV download...</span>
          </div>
        )}

        <p className="text-sm text-text-secondary">
          Choose export format and which sessions to include. Other active
          filters still apply.
        </p>

        <fieldset
          disabled={exporting}
          className="space-y-2 rounded border border-border p-3 disabled:opacity-60"
        >
          <legend className="px-1 text-sm font-bold">Export mode</legend>
          <label className="flex cursor-pointer items-start gap-3 rounded px-2 py-2 hover:bg-gray-50">
            <input
              type="radio"
              name="export-mode"
              checked={exportMode === "detailed"}
              onChange={() => setExportMode("detailed")}
              className="mt-1 accent-maroon"
            />
            <span className="min-w-0">
              <span className="block text-sm font-bold">Detailed</span>
              <span className="text-xs text-text-secondary">
                One row per student per session (roster-style).
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded px-2 py-2 hover:bg-gray-50">
            <input
              type="radio"
              name="export-mode"
              checked={exportMode === "summary"}
              onChange={() => setExportMode("summary")}
              className="mt-1 accent-maroon"
            />
            <span className="min-w-0">
              <span className="block text-sm font-bold">Summary</span>
              <span className="text-xs text-text-secondary">
                One row per student with the status counts you select. Only
                students who have those statuses are included. Total Sessions
                is included only when exporting multiple sessions.
              </span>
            </span>
          </label>
        </fieldset>

        {exportMode === "summary" && (
          <div className={exporting ? "pointer-events-none opacity-60" : undefined}>
            <SummaryStatusPicker
              selected={summaryColumns}
              onChange={setSummaryColumns}
            />
          </div>
        )}

        {sessions.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-secondary">
            No sessions available to export.
          </p>
        ) : (
          <div
            className={`max-h-[40vh] space-y-2 overflow-y-auto rounded border border-border p-3 ${
              exporting ? "pointer-events-none opacity-60" : ""
            }`}
          >
            <label className="flex cursor-pointer items-center gap-3 rounded px-2 py-2 hover:bg-gray-50">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="size-4 accent-maroon"
              />
              <span className="text-sm font-bold">Select all sessions</span>
            </label>

            {sessions.map((session) => {
              const count = recordCountBySession[session.id] ?? 0;
              return (
                <label
                  key={session.id}
                  className="flex cursor-pointer items-start gap-3 rounded px-2 py-2 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(session.id)}
                    onChange={() => toggleSession(session.id)}
                    className="mt-0.5 size-4 accent-maroon"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">
                      {session.title}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {formatDate(session.date)}
                      {session.department ? ` · ${session.department}` : ""}
                      {" · "}
                      {count} record{count !== 1 ? "s" : ""}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
