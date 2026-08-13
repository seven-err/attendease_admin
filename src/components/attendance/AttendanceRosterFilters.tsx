"use client";

import { useMemo, useState } from "react";
import {
  matchesAttendanceStatusFilter,
  NO_TIME_OUT_FILTER,
} from "@/lib/attendance";
import { ATTENDANCE_STATUSES, SessionAttendanceRow } from "@/lib/attendeaseTypes";
import { YEAR_LEVELS } from "@/lib/constants";
import { displayAttendanceStatusLabel } from "@/lib/format";
import { Search } from "lucide-react";

type AttendanceRosterFiltersProps = {
  search: string;
  onSearchChange: (value: string) => void;
  yearFilter: string;
  onYearFilterChange: (value: string) => void;
  statusFilter?: string;
  onStatusFilterChange?: (value: string) => void;
  showStatusFilter?: boolean;
};

export function AttendanceRosterFilters({
  search,
  onSearchChange,
  yearFilter,
  onYearFilterChange,
  statusFilter = "all",
  onStatusFilterChange,
  showStatusFilter = false,
}: AttendanceRosterFiltersProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
      <div className="relative min-w-0">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search student name or #..."
          className="h-10 w-full rounded border border-border pl-10 pr-3 text-sm outline-none"
        />
      </div>
      <select
        value={yearFilter}
        onChange={(e) => onYearFilterChange(e.target.value)}
        className="h-10 w-full min-w-0 rounded border border-border px-3 text-sm sm:min-w-[150px]"
      >
        <option value="all">All year levels</option>
        {YEAR_LEVELS.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
      {showStatusFilter && onStatusFilterChange && (
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="h-10 w-full min-w-0 rounded border border-border px-3 text-sm sm:min-w-[150px]"
        >
          <option value="all">All status</option>
          {ATTENDANCE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {displayAttendanceStatusLabel(status)}
            </option>
          ))}
          <option value={NO_TIME_OUT_FILTER}>{NO_TIME_OUT_FILTER}</option>
          <option value="Voided">Voided</option>
        </select>
      )}
    </div>
  );
}

export function filterAttendanceRows(
  rows: SessionAttendanceRow[],
  search: string,
  yearFilter: string,
  statusFilter = "all"
): SessionAttendanceRow[] {
  let list = rows;

  if (yearFilter !== "all") {
    list = list.filter((row) => row.year_level === yearFilter);
  }

  const query = search.trim().toLowerCase();
  if (query) {
    list = list.filter(
      (row) =>
        row.student_number.toLowerCase().includes(query) ||
        row.student_name.toLowerCase().includes(query)
    );
  }

  if (statusFilter !== "all") {
    list = list.filter((row) =>
      matchesAttendanceStatusFilter(row, statusFilter)
    );
  }

  return list;
}

export function useAttendanceRosterFilters(rows: SessionAttendanceRow[]) {
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Counts ignore status so Present/Late/etc. stay intact while filtering.
  const summaryRows = useMemo(
    () => filterAttendanceRows(rows, search, yearFilter, "all"),
    [rows, search, yearFilter]
  );

  const filteredRows = useMemo(
    () => filterAttendanceRows(rows, search, yearFilter, statusFilter),
    [rows, search, yearFilter, statusFilter]
  );

  return {
    search,
    setSearch,
    yearFilter,
    setYearFilter,
    statusFilter,
    setStatusFilter,
    summaryRows,
    filteredRows,
  };
}
