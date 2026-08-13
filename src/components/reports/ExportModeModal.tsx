"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { SummaryStatusPicker } from "@/components/reports/SummaryStatusPicker";
import {
  DEFAULT_SUMMARY_STATUS_COLUMNS,
  type AttendanceExportMode,
  type SummaryStatusColumn,
} from "@/lib/export-attendance";
import { Download, Loader2 } from "lucide-react";

export type ExportModeSelection = {
  mode: AttendanceExportMode;
  summaryColumns: SummaryStatusColumn[];
};

type ExportModeModalProps = {
  open: boolean;
  onClose: () => void;
  /** Return false (or throw) to keep the modal open after a failed export. */
  onExport: (
    selection: ExportModeSelection
  ) => boolean | void | Promise<boolean | void>;
  disabled?: boolean;
  recordCount?: number;
  title?: string;
  description?: string;
  summaryDescription?: string;
};

export function ExportModeModal({
  open,
  onClose,
  onExport,
  disabled = false,
  recordCount,
  title = "Export Attendance",
  description = "Choose detailed roster rows or a per-student status summary.",
  summaryDescription = "One row per student with the status counts you select.",
}: ExportModeModalProps) {
  const [exportMode, setExportMode] =
    useState<AttendanceExportMode>("detailed");
  const [summaryColumns, setSummaryColumns] = useState<SummaryStatusColumn[]>(
    [...DEFAULT_SUMMARY_STATUS_COLUMNS]
  );
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (open) {
      setExportMode("detailed");
      setSummaryColumns([...DEFAULT_SUMMARY_STATUS_COLUMNS]);
      setExporting(false);
    }
  }, [open]);

  const summaryReady =
    exportMode !== "summary" || summaryColumns.length > 0;

  async function handleExport() {
    if (!summaryReady || exporting || disabled) return;
    setExporting(true);
    try {
      const result = await onExport({ mode: exportMode, summaryColumns });
      if (result === false) return;
      onClose();
    } catch {
      // Keep modal open so the user can retry after seeing the error.
    } finally {
      setExporting(false);
    }
  }

  const exportLabel =
    exportMode === "summary"
      ? "summary"
      : typeof recordCount === "number"
        ? `${recordCount} record${recordCount !== 1 ? "s" : ""}`
        : "CSV";

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!exporting) onClose();
      }}
      title={title}
      panelClassName="max-w-md"
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
            disabled={disabled || !summaryReady || exporting}
            className="flex items-center gap-2 rounded bg-maroon px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {exporting ? "Exporting..." : `Export ${exportLabel}`}
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

        <p className="text-sm text-text-secondary">{description}</p>

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
                One row per student with time in, time out, and status.
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
                {summaryDescription}
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
      </div>
    </Modal>
  );
}
