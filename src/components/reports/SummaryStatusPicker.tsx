"use client";

import {
  DEFAULT_SUMMARY_STATUS_COLUMNS,
  SUMMARY_STATUS_COLUMNS,
  type SummaryStatusColumn,
} from "@/lib/export-attendance";

type SummaryStatusPickerProps = {
  selected: SummaryStatusColumn[];
  onChange: (next: SummaryStatusColumn[]) => void;
};

export function SummaryStatusPicker({
  selected,
  onChange,
}: SummaryStatusPickerProps) {
  const allSelected = selected.length === SUMMARY_STATUS_COLUMNS.length;

  function toggle(column: SummaryStatusColumn) {
    onChange(
      selected.includes(column)
        ? selected.filter((value) => value !== column)
        : [...selected, column]
    );
  }

  function toggleAll() {
    onChange(allSelected ? [] : [...DEFAULT_SUMMARY_STATUS_COLUMNS]);
  }

  return (
    <fieldset className="space-y-2 rounded border border-border p-3">
      <legend className="px-1 text-sm font-bold">Statuses to summarize</legend>
      <p className="px-2 text-xs text-text-secondary">
        Choose the statuses to export. If Absent is 20, select only Absent to
        export those 20 students — students with 0 are left out.
      </p>
      <label className="flex cursor-pointer items-center gap-3 rounded px-2 py-2 hover:bg-gray-50">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={toggleAll}
          className="size-4 accent-maroon"
        />
        <span className="text-sm font-bold">Select all</span>
      </label>
      {SUMMARY_STATUS_COLUMNS.map((column) => (
        <label
          key={column}
          className="flex cursor-pointer items-center gap-3 rounded px-2 py-2 hover:bg-gray-50"
        >
          <input
            type="checkbox"
            checked={selected.includes(column)}
            onChange={() => toggle(column)}
            className="size-4 accent-maroon"
          />
          <span className="text-sm">{column}</span>
        </label>
      ))}
    </fieldset>
  );
}
