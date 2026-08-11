"use server";

import { getPortalProfile } from "@/lib/auth";
import { can, scopedDepartment } from "@/lib/permissions";
import {
  getFilteredReportRecordsForExport,
  getReportsPageData,
  type ReportsQueryParams,
} from "@/lib/data/reports";

function applyDepartmentScope(
  profile: Awaited<ReturnType<typeof getPortalProfile>>,
  params: ReportsQueryParams
): ReportsQueryParams {
  const scope = scopedDepartment(profile);
  if (!scope) return params;
  return { ...params, department: scope };
}

export async function refreshReports(params: ReportsQueryParams) {
  const profile = await getPortalProfile();
  if (!profile || !can(profile, "reports.view")) {
    return { success: false as const, error: "Unauthorized." };
  }

  const data = await getReportsPageData(applyDepartmentScope(profile, params));

  return {
    success: true as const,
    ...data,
  };
}

export async function exportReports(
  params: ReportsQueryParams,
  sessionIds: string[]
) {
  const profile = await getPortalProfile();
  if (!profile || !can(profile, "reports.export")) {
    return {
      success: false as const,
      error: "You don't have permission to export reports.",
    };
  }

  const records = await getFilteredReportRecordsForExport(
    applyDepartmentScope(profile, params),
    sessionIds
  );

  return {
    success: true as const,
    records,
  };
}
