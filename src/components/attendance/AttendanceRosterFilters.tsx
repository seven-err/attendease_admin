"use client";

import { useMemo, useState } from "react";
import { SessionAttendanceRow } from "@/lib/attendeaseTypes";
import { YEAR_LEVELS } from "@/lib/constants";
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
    <div className="flex flex-wrap items-end gap-3">
      <div className="relative min-w-[200px] flex-1">
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
        className="h-10 min-w-[150px] rounded border border-border px-3 text-sm"
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
          className="h-10 min-w-[150px] rounded border border-border px-3 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="Present">Present</option>
          <option value="On Time">On Time</option>
          <option value="Late">Late</option>
          <option value="Absent">Absent</option>
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
  if (statusFilter !== "all") {
    list = list.filter((row) => row.attendance_status === statusFilter);
  }

  const query = search.trim().toLowerCase();
  if (query) {
    list = list.filter(
      (row) =>
        row.student_number.toLowerCase().includes(query) ||
        row.student_name.toLowerCase().includes(query)
    );
  }

  return list;
}

export function useAttendanceRosterFilters(rows: SessionAttendanceRow[]) {
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

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
    filteredRows,
  };
}
