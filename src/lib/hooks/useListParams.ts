"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PageSize } from "@/lib/pagination";

export function useListParams(initialSearch = "") {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(initialSearch);

  useEffect(() => {
    setSearchInput(initialSearch);
  }, [initialSearch]);

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      if (!pathname) return;

      const params = new URLSearchParams(searchParams?.toString() ?? "");

      for (const [key, value] of Object.entries(updates)) {
        if (!value) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchInput.trim() === initialSearch.trim()) return;
      updateParams({ q: searchInput.trim() || undefined, page: "1" });
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchInput, initialSearch, updateParams]);

  function setPage(page: number) {
    updateParams({ page: String(page) });
  }

  function setPageSize(pageSize: PageSize) {
    updateParams({ pageSize: String(pageSize), page: "1" });
  }

  return {
    searchInput,
    setSearchInput,
    setPage,
    setPageSize,
    updateParams,
  };
}
