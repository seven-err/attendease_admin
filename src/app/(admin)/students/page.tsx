import { Suspense } from "react";
import {
  getStudentsPaginated,
  type StudentsQueryParams,
} from "@/lib/data/students";
import type { PageSize } from "@/lib/pagination";
import {
  parsePageParam,
  parsePageSizeParam,
  parseSearchParam,
} from "@/lib/pagination";
import { PanelSkeleton, PageHeaderSkeleton } from "@/components/ui/PageSkeletons";
import { StudentsTable } from "./StudentsTable";

type StudentsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function StudentsTableFallback() {
  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeaderSkeleton />
      <PanelSkeleton className="h-24" />
      <PanelSkeleton className="h-[480px]" />
    </div>
  );
}

export default async function StudentsPage({ searchParams }: StudentsPageProps) {
  const params = await searchParams;
  const department =
    typeof params.dept === "string"
      ? params.dept
      : Array.isArray(params.dept)
        ? params.dept[0]
        : "all";
  const yearLevel =
    typeof params.year === "string"
      ? params.year
      : Array.isArray(params.year)
        ? params.year[0]
        : "all";

  const query: StudentsQueryParams = {
    page: parsePageParam(params.page),
    pageSize: parsePageSizeParam(params.pageSize),
    search: parseSearchParam(params.q),
    department: department || "all",
    yearLevel: yearLevel || "all",
  };

  const result = await getStudentsPaginated(query);

  return (
    <Suspense fallback={<StudentsTableFallback />}>
      <StudentsTable
        students={result.items}
        page={result.page}
        pageSize={result.pageSize as PageSize}
        total={result.total}
        totalPages={result.totalPages}
        search={query.search ?? ""}
        department={query.department ?? "all"}
        yearLevel={query.yearLevel ?? "all"}
      />
    </Suspense>
  );
}
