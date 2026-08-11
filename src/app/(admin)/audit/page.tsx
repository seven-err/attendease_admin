import { redirect } from "next/navigation";
import { getPortalProfile } from "@/lib/auth";
import {
  isDepartmentAdmin,
  isSuperAdmin,
  scopedDepartment,
} from "@/lib/permissions";
import { listAuditLogs } from "@/lib/admin/audit";
import type { PageSize } from "@/lib/pagination";
import {
  parsePageParam,
  parsePageSizeParam,
  parseSearchParam,
} from "@/lib/pagination";
import { AuditLogViewer } from "./AuditLogViewer";

type AuditPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const profile = await getPortalProfile();
  if (!profile || (!isSuperAdmin(profile) && !isDepartmentAdmin(profile))) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const result = await listAuditLogs({
    page: parsePageParam(params.page),
    pageSize: parsePageSizeParam(params.pageSize),
    search: parseSearchParam(params.q),
  });

  return (
    <AuditLogViewer
      logs={result.items}
      page={result.page}
      pageSize={result.pageSize as PageSize}
      total={result.total}
      totalPages={result.totalPages}
      search={parseSearchParam(params.q)}
      scopedLabel={scopedDepartment(profile)}
    />
  );
}
