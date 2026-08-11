import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getPortalProfile } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  getStudentsPaginated,
  type StudentsQueryParams,
} from "@/lib/data/students";
import {
  getStaffDepartments,
  getStaffPaginated,
  type StaffQueryParams,
} from "@/lib/data/staff";
import type { PageSize } from "@/lib/pagination";
import {
  parsePageParam,
  parsePageSizeParam,
  parseSearchParam,
} from "@/lib/pagination";
import { PanelSkeleton, PageHeaderSkeleton } from "@/components/ui/PageSkeletons";
import { StaffTable } from "./StaffTable";
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

function firstParam(
  value: string | string[] | undefined,
  fallback: string
): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] ?? fallback;
  return fallback;
}

export default async function StudentsPage({ searchParams }: StudentsPageProps) {
  const profile = await getPortalProfile();
  if (!profile || !can(profile, "people.view")) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const kind = firstParam(params.kind, "students") === "staff" ? "staff" : "students";
  const department = firstParam(params.dept, "all") || "all";
  const yearLevel = firstParam(params.year, "all") || "all";
  const page = parsePageParam(params.page);
  const pageSize = parsePageSizeParam(params.pageSize);
  const search = parseSearchParam(params.q);

  if (kind === "staff") {
    const query: StaffQueryParams = {
      page,
      pageSize,
      search,
      department,
    };
    const [result, departments] = await Promise.all([
      getStaffPaginated(query),
      getStaffDepartments(),
    ]);

    return (
      <Suspense fallback={<StudentsTableFallback />}>
        <StaffTable
          staff={result.items}
          departments={departments}
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

  const query: StudentsQueryParams = {
    page,
    pageSize,
    search,
    department,
    yearLevel,
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
