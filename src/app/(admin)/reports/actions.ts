"use server";

import { getAdminProfile } from "@/lib/auth";
import {
  getFilteredReportRecordsForExport,
  getReportsPageData,
  type ReportsQueryParams,
} from "@/lib/data/reports";

export async function refreshReports(params: ReportsQueryParams) {
  const profile = await getAdminProfile();
  if (!profile) {
    return { success: false as const, error: "Unauthorized." };
  }

  const data = await getReportsPageData(params);

  return {
    success: true as const,
    ...data,
  };
}

export async function exportReports(
  params: ReportsQueryParams,
  sessionIds: string[]
) {
  const profile = await getAdminProfile();
  if (!profile) {
    return { success: false as const, error: "Unauthorized." };
  }

  const records = await getFilteredReportRecordsForExport(params, sessionIds);

  return {
    success: true as const,
    records,
  };
}
