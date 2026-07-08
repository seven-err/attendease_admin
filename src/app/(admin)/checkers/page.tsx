import { Suspense } from "react";
import {
  getCheckersPaginated,
  type CheckersQueryParams,
} from "@/lib/data/checkers";
import type { PageSize } from "@/lib/pagination";
import {
  parsePageParam,
  parsePageSizeParam,
  parseSearchParam,
} from "@/lib/pagination";
import { PanelSkeleton, PageHeaderSkeleton } from "@/components/ui/PageSkeletons";
import { CheckersTable } from "./CheckersTable";

type CheckersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function CheckersTableFallback() {
  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeaderSkeleton />
      <PanelSkeleton className="h-24" />
      <PanelSkeleton className="h-[480px]" />
    </div>
  );
}

export default async function CheckersPage({ searchParams }: CheckersPageProps) {
  const params = await searchParams;
  const department =
    typeof params.dept === "string"
      ? params.dept
      : Array.isArray(params.dept)
        ? params.dept[0]
        : "all";

  const query: CheckersQueryParams = {
    page: parsePageParam(params.page),
    pageSize: parsePageSizeParam(params.pageSize),
    search: parseSearchParam(params.q),
    department: department || "all",
  };

  const result = await getCheckersPaginated(query);

  return (
    <Suspense fallback={<CheckersTableFallback />}>
      <CheckersTable
        checkers={result.items}
        page={result.page}
        pageSize={result.pageSize as PageSize}
        total={result.total}
        totalPages={result.totalPages}
        search={query.search ?? ""}
        department={query.department ?? "all"}
      />
    </Suspense>
  );
}
