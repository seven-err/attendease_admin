import { cache } from "react";
import {
  ADMIN_ROLE,
  DEPARTMENT_ADMIN_ROLE,
  PORTAL_ROLES,
  type PortalRole,
} from "@/lib/constants";
import { AppUserProfile } from "@/lib/attendeaseTypes";
import {
  isPortalRole,
  normalizePermissionKeys,
  permissionsFor,
  type PermissionKey,
} from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type PortalProfile = AppUserProfile & {
  role: PortalRole;
  permissions: PermissionKey[];
};

function mapPortalProfile(
  data: {
    id: string;
    full_name: string;
    email: string | null;
    role: string;
    status: AppUserProfile["status"];
    department: string | null;
  },
  fallbackEmail: string,
  permissions: PermissionKey[]
): PortalProfile | null {
  if (!isPortalRole(data.role) || data.status !== "active") {
    return null;
  }

  if (
    data.role === DEPARTMENT_ADMIN_ROLE &&
    !data.department?.trim()
  ) {
    return null;
  }

  return {
    id: data.id,
    full_name: data.full_name,
    email: data.email ?? fallbackEmail,
    role: data.role,
    status: data.status,
    department: data.department,
    permissions:
      data.role === ADMIN_ROLE ? permissionsFor(ADMIN_ROLE) : permissions,
  };
}

async function loadDepartmentAdminPermissions(
  userId: string
): Promise<PermissionKey[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("department_admin_permissions")
    .select("permission_key")
    .eq("user_id", userId);

  if (error || !data) return [];
  return normalizePermissionKeys(data.map((row) => row.permission_key));
}

/** Active portal user (super admin or department admin). Request-memoized. */
export const getPortalProfile = cache(
  async (): Promise<PortalProfile | null> => {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return null;

      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, email, role, status, department")
        .eq("id", user.id)
        .in("role", [...PORTAL_ROLES])
        .eq("status", "active")
        .maybeSingle();

      if (error || !data) return null;

      const permissions =
        data.role === DEPARTMENT_ADMIN_ROLE
          ? await loadDepartmentAdminPermissions(data.id)
          : permissionsFor(ADMIN_ROLE);

      return mapPortalProfile(data, user.email ?? "", permissions);
    } catch {
      // Supabase unreachable — treat as signed out so pages can redirect cleanly.
      return null;
    }
  }
);

/** @deprecated Prefer getPortalProfile — kept for existing call sites. */
export async function getAdminProfile(): Promise<PortalProfile | null> {
  return getPortalProfile();
}

export async function requirePortalProfile(): Promise<PortalProfile> {
  const profile = await getPortalProfile();
  if (!profile) {
    throw new Error("Unauthorized");
  }
  return profile;
}

export async function requireSuperAdmin(): Promise<PortalProfile> {
  const profile = await requirePortalProfile();
  if (profile.role !== ADMIN_ROLE) {
    throw new Error("Forbidden");
  }
  return profile;
}

export function unauthorizedResult<T extends { error: string }>(
  message = "Unauthorized"
): T {
  return { error: message } as T;
}

export function forbiddenResult<T extends { error: string }>(
  message = "You don't have permission to perform this action."
): T {
  return { error: message } as T;
}
