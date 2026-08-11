import type { DashboardStats } from "@/lib/attendeaseTypes";
import { getPortalProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { scopedDepartment } from "@/lib/permissions";

type OverviewRpcResult = {
  open_sessions?: number;
  attendance_today?: number;
  active_people?: number;
  active_checkers?: number;
  active_departments?: number;
  department?: string | null;
};

export type AdminOverviewStats = DashboardStats & {
  activeDepartments: number;
  scopedDepartment: string | null;
};

export async function getAdminOverviewStats(): Promise<AdminOverviewStats> {
  const profile = await getPortalProfile();
  const supabase = await createClient();
  const scope = scopedDepartment(profile);

  const { data, error } = await supabase.rpc("get_admin_overview_stats", {
    p_department: scope,
  });

  if (!error && data && typeof data === "object") {
    const row = data as OverviewRpcResult;
    return {
      activeCheckers: row.active_checkers ?? 0,
      totalStudents: row.active_people ?? 0,
      openSessionsToday: row.open_sessions ?? 0,
      scansToday: row.attendance_today ?? 0,
      activeDepartments: row.active_departments ?? 0,
      scopedDepartment: row.department ?? scope,
    };
  }

  // Fallback: RLS-scoped table counts if RPC unavailable
  const { getDashboardStats } = await import("@/lib/data/dashboard");
  const fallback = await getDashboardStats();
  return {
    ...fallback,
    activeDepartments: scope ? 1 : 0,
    scopedDepartment: scope,
  };
}
