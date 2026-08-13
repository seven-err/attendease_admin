"use client";

import { useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { downloadCsv } from "@/lib/export-attendance";
import {
  parseStaffImportCsv,
  staffImportCsvTemplate,
} from "@/lib/validations/staff-import";
import { importStaffFromCsv } from "./actions";
import { Download, FileUp } from "lucide-react";

type ImportStaffCsvModalProps = {
  open: boolean;
  onClose: () => void;
  onImported: (message: string) => void;
};

export function ImportStaffCsvModal({
  open,
  onClose,
  onImported,
}: ImportStaffCsvModalProps) {
  const [isPending, startTransition] = useTransition();
  const [csvText, setCsvText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => {
    if (!csvText.trim()) {
      return { rows: [], errors: [] as { row: number; message: string }[] };
    }
    return parseStaffImportCsv(csvText);
  }, [csvText]);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(String(reader.result ?? ""));
      setError(null);
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function downloadTemplate() {
    downloadCsv("staff-import-template.csv", staffImportCsvTemplate());
  }

  function handleImport() {
    setError(null);
    startTransition(async () => {
      const result = await importStaffFromCsv(csvText);
      if (!result.success) {
        setError(result.error);
        return;
      }

      const errorNote =
        result.errors.length > 0
          ? ` ${result.errors.length} row issue${result.errors.length !== 1 ? "s" : ""} logged.`
          : "";

      onImported(
        `Imported ${result.imported} employee${result.imported !== 1 ? "s" : ""}. Skipped ${result.skipped}.${errorNote}`
      );
      setCsvText("");
      onClose();
    });
  }

  function handleClose() {
    if (isPending) return;
    setError(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Import Staff from CSV"
      panelClassName="max-w-2xl"
      footer={
        <>
          <button
            type="button"
            onClick={handleClose}
            disabled={isPending}
            className="px-4 py-2 text-sm font-bold text-foreground disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={isPending || preview.rows.length === 0}
            className="flex items-center gap-2 rounded bg-maroon px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            <FileUp className="size-4" />
            {isPending
              ? "Importing..."
              : `Import ${preview.rows.length} employee${preview.rows.length !== 1 ? "s" : ""}`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          Upload a CSV with full name, department, job title, and optional
          status. Employee numbers are auto-generated as EMP-DEPARTMENT-000.
        </p>

        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-border px-3 py-2 text-sm font-bold hover:bg-gray-50">
            <FileUp className="size-4" />
            Choose CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 rounded border border-border px-3 py-2 text-sm font-bold hover:bg-gray-50"
          >
            <Download className="size-4" />
            Download template
          </button>
        </div>

        <div>
          <label className="mb-1 block text-sm font-bold">CSV preview</label>
          <textarea
            value={csvText}
            onChange={(event) => {
              setCsvText(event.target.value);
              setError(null);
            }}
            placeholder={staffImportCsvTemplate()}
            rows={8}
            className="w-full rounded border border-border px-3 py-2 font-mono text-xs outline-none focus:border-maroon"
          />
        </div>

        <div className="rounded-lg border border-border bg-header-bg px-3 py-2 text-sm">
          <p>
            <span className="font-bold">{preview.rows.length}</span> valid row
            {preview.rows.length !== 1 ? "s" : ""} ready to import
          </p>
          {preview.errors.length > 0 && (
            <p className="mt-1 text-red-600">
              {preview.errors.length} validation issue
              {preview.errors.length !== 1 ? "s" : ""} found
            </p>
          )}
        </div>

        {preview.errors.length > 0 && (
          <div className="max-h-40 overflow-y-auto rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {preview.errors.slice(0, 8).map((item) => (
              <p key={`${item.row}-${item.message}`}>
                Row {item.row}: {item.message}
              </p>
            ))}
            {preview.errors.length > 8 && (
              <p className="mt-1 font-bold">
                And {preview.errors.length - 8} more...
              </p>
            )}
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
