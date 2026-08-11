import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getPortalProfile } from "@/lib/auth";
import { can, scopedDepartment } from "@/lib/permissions";
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
import { QrManager } from "./QrManager";

type QrPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function QrFallback() {
  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeaderSkeleton />
      <PanelSkeleton className="h-24" />
      <PanelSkeleton className="h-[480px]" />
    </div>
  );
}

export default async function QrPage({ searchParams }: QrPageProps) {
  const profile = await getPortalProfile();
  if (!profile || !can(profile, "qr.view")) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const scope = scopedDepartment(profile);
  const departmentParam =
    typeof params.dept === "string"
      ? params.dept
      : Array.isArray(params.dept)
        ? params.dept[0]
        : "all";

  const query: StudentsQueryParams = {
    page: parsePageParam(params.page),
    pageSize: parsePageSizeParam(params.pageSize),
    search: parseSearchParam(params.q),
    department: scope ?? departmentParam ?? "all",
  };

  const result = await getStudentsPaginated(query);

  return (
    <Suspense fallback={<QrFallback />}>
      <QrManager
        students={result.items}
        page={result.page}
        pageSize={result.pageSize as PageSize}
        total={result.total}
        totalPages={result.totalPages}
        search={query.search ?? ""}
        department={query.department ?? "all"}
        canGenerate={can(profile, "qr.generate")}
        canRegenerate={can(profile, "qr.regenerate")}
        canExport={can(profile, "qr.export")}
        scopedDepartment={scope}
      />
    </Suspense>
  );
}
