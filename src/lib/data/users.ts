import { createClient } from "@/lib/supabase/server";
import {
  normalizePermissionKeys,
  type PermissionKey,
} from "@/lib/permissions";
import type { AppRole } from "@/lib/constants";

export type PortalUserRow = {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  status: "active" | "inactive" | "archived";
  department: string | null;
  created_at: string;
  updated_at: string;
  permissions: PermissionKey[];
};

export async function listPortalUsers(): Promise<PortalUserRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select(
      "id, full_name, email, role, status, department, created_at, updated_at"
    )
    .in("role", ["admin", "department_admin"])
    .order("full_name");

  if (error) throw new Error(error.message);

  const users = data ?? [];
  const deptAdminIds = users
    .filter((u) => u.role === "department_admin")
    .map((u) => u.id);

  const permissionMap = new Map<string, PermissionKey[]>();
  if (deptAdminIds.length) {
    const { data: grants } = await supabase
      .from("department_admin_permissions")
      .select("user_id, permission_key")
      .in("user_id", deptAdminIds);

    for (const grant of grants ?? []) {
      const current = permissionMap.get(grant.user_id) ?? [];
      current.push(grant.permission_key as PermissionKey);
      permissionMap.set(grant.user_id, current);
    }
  }

  return users.map((user) => ({
    ...user,
    permissions:
      user.role === "admin"
        ? normalizePermissionKeys([])
        : normalizePermissionKeys(permissionMap.get(user.id) ?? []),
  })) as PortalUserRow[];
}

export async function getUserPermissions(
  userId: string
): Promise<PermissionKey[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("department_admin_permissions")
    .select("permission_key")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return normalizePermissionKeys((data ?? []).map((row) => row.permission_key));
}
