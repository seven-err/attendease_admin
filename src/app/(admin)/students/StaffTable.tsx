"use client";

import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import type { StaffWithAssignment } from "@/lib/attendeaseTypes";
import { useListParams } from "@/lib/hooks/useListParams";
import type { PageSize } from "@/lib/pagination";
import { truncateToken } from "@/lib/format";
import { Search } from "lucide-react";
import { PeopleKindTabs } from "./PeopleKindTabs";

type StaffTableProps = {
  staff: StaffWithAssignment[];
  departments: string[];
  page: number;
  pageSize: PageSize;
  total: number;
  totalPages: number;
  search: string;
  department: string;
};

export function StaffTable({
  staff,
  departments,
  page,
  pageSize,
  total,
  totalPages,
  search,
  department,
}: StaffTableProps) {
  const { searchInput, setSearchInput, setPage, setPageSize, updateParams } =
    useListParams(search);

  function updateFilter(value: string) {
    updateParams({
      dept: value === "all" ? undefined : value,
      page: "1",
    });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title="People"
        description="Students and CRMC staff roster"
      />

      <PeopleKindTabs active="staff" />

      <div className="card flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search staff..."
            className="input-field pl-10"
          />
        </div>

        <select
          className="select-field min-w-[180px]"
          value={department}
          onChange={(e) => updateFilter(e.target.value)}
        >
          <option value="all">All departments</option>
          {departments.map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="card-header">
          <h3 className="font-bold">Staff Directory</h3>
          <span className="text-xs text-text-secondary">
            {total} staff member{total !== 1 ? "s" : ""} total
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="table-row-hover w-full min-w-[800px] text-sm">
            <thead className="border-b border-border bg-header-bg">
              <tr className="text-left text-xs uppercase tracking-wide text-text-secondary">
                <th className="px-4 py-3 font-bold">Employee #</th>
                <th className="px-4 py-3 font-bold">Full Name</th>
                <th className="px-4 py-3 font-bold">Dept</th>
                <th className="px-4 py-3 font-bold">Job title</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold">QR Token</th>
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-text-secondary"
                  >
                    {search || department !== "all"
                      ? "No staff match your filters."
                      : "No staff found in the database."}
                  </td>
                </tr>
              ) : (
                staff.map((member) => (
                  <tr key={member.id} className="border-b border-border-subtle">
                    <td className="px-4 py-4 font-mono text-sm">
                      {member.person_number}
                    </td>
                    <td className="px-4 py-4 font-bold">{member.full_name}</td>
                    <td className="px-4 py-4">
                      {member.department ? (
                        <Badge dept={member.department}>{member.department}</Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-4">{member.job_title ?? "—"}</td>
                    <td className="px-4 py-4">
                      <Badge
                        variant={
                          member.person_status === "Active"
                            ? "active"
                            : "inactive"
                        }
                      >
                        {member.person_status}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs text-text-secondary">
                      {truncateToken(member.qr_token ?? "")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          itemLabel="staff"
        />
      </div>
    </div>
  );
}
