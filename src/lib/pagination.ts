export const DEFAULT_PAGE_SIZE = 25;

export const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function parsePageParam(
  value: string | string[] | undefined
): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
}

export function parsePageSizeParam(
  value: string | string[] | undefined
): PageSize {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  if (PAGE_SIZE_OPTIONS.includes(parsed as PageSize)) {
    return parsed as PageSize;
  }
  return DEFAULT_PAGE_SIZE;
}

export function parseSearchParam(
  value: string | string[] | undefined
): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ?? "";
}

export function buildPaginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number
): PaginatedResult<T> {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  return {
    items,
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

export function getRange(
  page: number,
  pageSize: number
): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function pageRange(
  page: number,
  pageSize: number,
  total: number
): { from: number; to: number } {
  if (total === 0) {
    return { from: 0, to: -1 };
  }

  return getRange(page, pageSize);
}

export function showingRange(
  page: number,
  pageSize: number,
  total: number
): { start: number; end: number } {
  if (total === 0) {
    return { start: 0, end: 0 };
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return { start, end };
}
