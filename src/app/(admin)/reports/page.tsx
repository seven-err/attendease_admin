import { Suspense } from "react";
import {
  buildReportsQueryParams,
  getReportsPageData,
} from "@/lib/data/reports";
import type { PageSize } from "@/lib/pagination";
import { PanelSkeleton, PageHeaderSkeleton } from "@/components/ui/PageSkeletons";
import { ReportsTable } from "./ReportsTable";

type ReportsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function ReportsTableFallback() {
  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeaderSkeleton />
      <PanelSkeleton className="h-28" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <PanelSkeleton key={index} className="h-28" />
        ))}
      </div>
      <PanelSkeleton className="h-[480px]" />
    </div>
  );
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams;
  const query = buildReportsQueryParams(params);
  const data = await getReportsPageData(query);

  return (
    <Suspense fallback={<ReportsTableFallback />}>
      <ReportsTable
        records={data.records}
        page={data.page}
        pageSize={data.pageSize as PageSize}
        total={data.total}
        totalPages={data.totalPages}
        stats={data.stats}
        sessions={data.sessions}
        recordCountBySession={data.recordCountBySession}
        query={query}
      />
    </Suspense>
  );
}
