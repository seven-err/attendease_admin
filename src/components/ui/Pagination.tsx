"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  PAGE_SIZE_OPTIONS,
  type PageSize,
  showingRange,
} from "@/lib/pagination";
import { cn } from "@/lib/utils";

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: PageSize) => void;
  itemLabel?: string;
};

function getVisiblePages(page: number, totalPages: number): number[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages, page]);
  if (page > 1) pages.add(page - 1);
  if (page < totalPages) pages.add(page + 1);

  return [...pages].sort((a, b) => a - b);
}

export function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  itemLabel = "items",
}: PaginationProps) {
  if (total === 0) return null;

  const { start, end } = showingRange(page, pageSize, total);
  const visiblePages = getVisiblePages(page, totalPages);

  return (
    <div className="flex flex-col gap-3 border-t border-border-subtle bg-surface-raised/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-sm text-text-secondary">
        <span>
          Showing {start}–{end} of {total} {itemLabel}
        </span>
        {onPageSizeChange && (
          <label className="flex items-center gap-2">
            <span className="text-xs font-medium">Rows</span>
            <select
              value={pageSize}
              onChange={(event) =>
                onPageSizeChange(Number(event.target.value) as PageSize)
              }
              className="select-field h-8 px-2"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="btn-icon disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </button>

        {visiblePages.map((pageNumber, index) => {
          const prev = visiblePages[index - 1];
          const showEllipsis = prev !== undefined && pageNumber - prev > 1;

          return (
            <span key={pageNumber} className="flex items-center gap-1">
              {showEllipsis && (
                <span className="px-1 text-sm text-text-muted">…</span>
              )}
              <button
                type="button"
                onClick={() => onPageChange(pageNumber)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md text-sm font-bold transition-colors",
                  pageNumber === page
                    ? "bg-maroon text-white shadow-sm"
                    : "text-text-secondary hover:bg-maroon-light hover:text-maroon"
                )}
                aria-label={`Page ${pageNumber}`}
                aria-current={pageNumber === page ? "page" : undefined}
              >
                {pageNumber}
              </button>
            </span>
          );
        })}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="btn btn-secondary ml-1 h-8 px-3 py-0 text-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
