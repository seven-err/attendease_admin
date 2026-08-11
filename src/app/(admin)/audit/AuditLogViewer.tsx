"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import type { AuditLogRow } from "@/lib/admin/audit";
import { useListParams } from "@/lib/hooks/useListParams";
import type { PageSize } from "@/lib/pagination";
import { formatDateTime } from "@/lib/format";
import { Search } from "lucide-react";

type AuditLogViewerProps = {
  logs: AuditLogRow[];
  page: number;
  pageSize: PageSize;
  total: number;
  totalPages: number;
  search: string;
  scopedLabel?: string | null;
};

function metadataSummary(metadata: Record<string, unknown>): string {
  const keys = Object.keys(metadata);
  if (keys.length === 0) return "—";
  const parts: string[] = [];
  for (const key of keys.slice(0, 4)) {
    const value = metadata[key];
    if (value === null || value === undefined) continue;
    if (typeof value === "object") {
      parts.push(`${key}:{…}`);
      continue;
    }
    const text = String(value);
    parts.push(`${key}=${text.length > 24 ? `${text.slice(0, 24)}…` : text}`);
  }
  if (keys.length > 4) parts.push(`+${keys.length - 4} more`);
  return parts.join(", ") || "—";
}

export function AuditLogViewer({
  logs,
  page,
  pageSize,
  total,
  totalPages,
  search,
  scopedLabel,
}: AuditLogViewerProps) {
  const { searchInput, setSearchInput, setPage, setPageSize } =
    useListParams(search);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title="Audit Log"
        description={
          scopedLabel
            ? `Administrative actions for ${scopedLabel}`
            : "Review administrative actions across the campus"
        }
      />

      <div className="card flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search action, target, department..."
            className="input-field pl-10"
          />
        </div>
        <span className="text-xs text-text-secondary">
          {total} event{total !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-row-hover w-full min-w-[960px] text-sm">
            <thead className="border-b border-border bg-header-bg">
              <tr className="text-left text-xs uppercase tracking-wide text-text-secondary">
                <th className="px-4 py-3 font-bold">Timestamp</th>
                <th className="px-4 py-3 font-bold">Actor</th>
                <th className="px-4 py-3 font-bold">Action</th>
                <th className="px-4 py-3 font-bold">Target</th>
                <th className="px-4 py-3 font-bold">Department</th>
                <th className="px-4 py-3 font-bold">School</th>
                <th className="px-4 py-3 font-bold">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-text-secondary"
                  >
                    No audit events found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const target = [log.target_type, log.target_id]
                    .filter(Boolean)
                    .join(" · ");
                  const expanded = expandedId === log.id;
                  return (
                    <tr
                      key={log.id}
                      className="border-b border-border-subtle align-top"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-text-secondary">
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold">
                          {log.actor_name ?? "Unknown"}
                        </p>
                        {log.actor_email && (
                          <p className="text-xs text-text-muted">
                            {log.actor_email}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="dept">{log.action}</Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {target || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {log.department ? (
                          <Badge dept={log.department}>{log.department}</Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                        {log.school_id
                          ? `${log.school_id.slice(0, 8)}…`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="text-left text-xs text-text-secondary hover:text-maroon"
                          onClick={() =>
                            setExpandedId(expanded ? null : log.id)
                          }
                        >
                          {expanded
                            ? JSON.stringify(log.metadata, null, 2)
                            : metadataSummary(log.metadata)}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border px-4 py-3">
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>
    </div>
  );
}
