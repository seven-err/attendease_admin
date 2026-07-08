"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { ReportSessionOption } from "@/lib/data/report-utils";
import { formatDate } from "@/lib/format";
import { Download } from "lucide-react";

type ExportSessionModalProps = {
  open: boolean;
  onClose: () => void;
  sessions: ReportSessionOption[];
  recordCountBySession: Record<string, number>;
  onExport: (sessionIds: string[]) => void;
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

  useEffect(() => {
    if (open) {
      setSelectedIds(allSessionIds);
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

  function handleExport() {
    if (selectedIds.length === 0) return;
    onExport(selectedIds);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Export Attendance"
      panelClassName="max-w-lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={selectedCount === 0 || exportableCount === 0}
            className="flex items-center gap-2 rounded bg-maroon px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            <Download className="size-4" />
            Export {exportableCount} record{exportableCount !== 1 ? "s" : ""}
          </button>
        </>
      }
    >
      <p className="mb-4 text-sm text-text-secondary">
        Choose which sessions to include in the CSV export. Other active filters
        still apply.
      </p>

      {sessions.length === 0 ? (
        <p className="py-4 text-center text-sm text-text-secondary">
          No sessions available to export.
        </p>
      ) : (
        <div className="max-h-[50vh] space-y-2 overflow-y-auto rounded border border-border p-3">
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
                  <span className="block text-sm font-bold">{session.title}</span>
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
    </Modal>
  );
}
