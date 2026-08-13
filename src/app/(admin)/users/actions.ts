"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/admin/audit";
import {
  forbiddenResult,
  getPortalProfile,
  requireSuperAdmin,
  type PortalProfile,
} from "@/lib/auth";
import {
  ADMIN_ROLE,
  DEPARTMENT_ADMIN_ROLE,
  type PortalRole,
} from "@/lib/constants";
import {
  DEFAULT_DEPARTMENT_ADMIN_PERMISSIONS,
  isPermissionKey,
  normalizePermissionKeys,
  type PermissionKey,
} from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type UserActionResult =
  | { success: true; tempPassword?: string; userId?: string }
  | { success: false; error: string };

function generateTempPassword(): string {
  return randomBytes(18)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 18);
}

async function assertSuperAdmin(): Promise<
  { profile: PortalProfile } | { error: UserActionResult }
> {
  try {
    const profile = await requireSuperAdmin();
    return { profile };
  } catch {
    return {
      error: {
        success: false,
        error: "Only super admins can manage portal users.",
      },
    };
  }
}

async function savePermissions(
  userId: string,
  permissions: PermissionKey[],
  actor: PortalProfile
): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_department_admin_permissions", {
    p_user_id: userId,
    p_permission_keys: permissions,
  });
  if (error) return error.message;

  await writeAuditLog(actor, {
    action: "permissions.update",
    targetType: "user",
    targetId: userId,
    metadata: { permissions },
  });
  return null;
}

function parsePermissions(raw: FormDataEntryValue | null): PermissionKey[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw));
    if (!Array.isArray(parsed)) return [];
    return normalizePermissionKeys(
      parsed.filter((item): item is string => typeof item === "string")
    );
  } catch {
    return [];
  }
}

export async function createPortalUser(
  formData: FormData
): Promise<UserActionResult> {
  const auth = await assertSuperAdmin();
  if ("error" in auth) return auth.error;
  const { profile } = auth;

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "").trim() as PortalRole;
  const department = String(formData.get("department") ?? "").trim() || null;
  const schoolId = String(formData.get("school_id") ?? "").trim() || null;
  const sendInvite = String(formData.get("send_invite") ?? "") === "1";
  const permissions = parsePermissions(formData.get("permissions"));

  if (!fullName || !email) {
    return { success: false, error: "Full name and email are required." };
  }
  if (role !== ADMIN_ROLE && role !== DEPARTMENT_ADMIN_ROLE) {
    return { success: false, error: "Invalid role." };
  }
  if (role === DEPARTMENT_ADMIN_ROLE && !department) {
    return {
      success: false,
      error: "Department admins must be assigned to a department.",
    };
  }
  if (role === ADMIN_ROLE && department) {
    return {
      success: false,
      error: "Super admins cannot be department-scoped.",
    };
  }

  if (role === DEPARTMENT_ADMIN_ROLE && schoolId) {
    const supabase = await createClient();
    const { data: dept } = await supabase
      .from("departments")
      .select("code, school_id")
      .eq("code", department)
      .maybeSingle();
    if (!dept || dept.school_id !== schoolId) {
      return {
        success: false,
        error: "Selected department does not belong to that school.",
      };
    }
  }

  const tempPassword = generateTempPassword();
  const admin = createAdminClient();

  // auth.users insert fires handle_new_user(), which creates public.users.
  // Pass role/department in metadata so the stub row is correct, then upsert
  // remaining profile fields (do not insert — that hits users_pkey).
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role,
      ...(role === DEPARTMENT_ADMIN_ROLE && department
        ? { department }
        : {}),
    },
  });

  if (authError || !authUser.user) {
    return {
      success: false,
      error: authError?.message ?? "Failed to create auth user.",
    };
  }

  const { error: profileError } = await admin.from("users").upsert(
    {
      id: authUser.user.id,
      full_name: fullName,
      email,
      role,
      status: "active",
      department: role === DEPARTMENT_ADMIN_ROLE ? department : null,
      checker_scope: "department",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (profileError) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    return { success: false, error: profileError.message };
  }

  if (role === DEPARTMENT_ADMIN_ROLE) {
    const keys =
      permissions.length > 0
        ? permissions
        : [...DEFAULT_DEPARTMENT_ADMIN_PERMISSIONS];
    const permError = await savePermissions(authUser.user.id, keys, profile);
    if (permError) {
      return {
        success: false,
        error: `User created but permissions failed: ${permError}`,
      };
    }
  }

  if (sendInvite) {
    await admin.auth.admin.generateLink({
      type: "recovery",
      email,
    });
  }

  await writeAuditLog(profile, {
    action: "user.create",
    targetType: "user",
    targetId: authUser.user.id,
    department,
    metadata: { role, email, sendInvite },
  });

  revalidatePath("/users");
  revalidatePath("/departments");
  return {
    success: true,
    tempPassword: sendInvite ? undefined : tempPassword,
    userId: authUser.user.id,
  };
}

export async function updatePortalUser(
  formData: FormData
): Promise<UserActionResult> {
  const auth = await assertSuperAdmin();
  if ("error" in auth) return auth.error;
  const { profile } = auth;

  const userId = String(formData.get("user_id") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "").trim() as PortalRole;
  const department = String(formData.get("department") ?? "").trim() || null;
  const permissions = parsePermissions(formData.get("permissions"));

  if (!userId || !fullName || !email) {
    return { success: false, error: "Name and email are required." };
  }
  if (role !== ADMIN_ROLE && role !== DEPARTMENT_ADMIN_ROLE) {
    return { success: false, error: "Invalid role." };
  }
  if (role === DEPARTMENT_ADMIN_ROLE && !department) {
    return {
      success: false,
      error: "Department admins must be assigned to a department.",
    };
  }
  if (userId === profile.id && role !== ADMIN_ROLE) {
    return {
      success: false,
      error: "You cannot demote your own super admin account.",
    };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("users")
    .select("id, email, role, department")
    .eq("id", userId)
    .in("role", [ADMIN_ROLE, DEPARTMENT_ADMIN_ROLE])
    .maybeSingle();

  if (!existing) return { success: false, error: "User not found." };

  const previousEmail = (existing.email ?? "").trim().toLowerCase();
  const emailChanged = email !== previousEmail;

  if (emailChanged) {
    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return {
        success: false,
        error:
          "Server is missing SUPABASE_SERVICE_ROLE_KEY. Add it to your environment variables.",
      };
    }

    const { error: authError } = await admin.auth.admin.updateUserById(
      userId,
      {
        email,
        email_confirm: true,
      }
    );
    if (authError) {
      return {
        success: false,
        error: authError.message ?? "Failed to update auth email.",
      };
    }

    const { error: emailError } = await admin
      .from("users")
      .update({
        full_name: fullName,
        email,
        role,
        department: role === DEPARTMENT_ADMIN_ROLE ? department : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .in("role", [ADMIN_ROLE, DEPARTMENT_ADMIN_ROLE]);

    if (emailError) {
      return {
        success: false,
        error: emailError.message ?? "Failed to update profile email.",
      };
    }
  } else {
    const { error } = await supabase
      .from("users")
      .update({
        full_name: fullName,
        role,
        department: role === DEPARTMENT_ADMIN_ROLE ? department : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) return { success: false, error: error.message };
  }

  if (role === DEPARTMENT_ADMIN_ROLE) {
    const permError = await savePermissions(userId, permissions, profile);
    if (permError) return { success: false, error: permError };
  } else {
    await supabase
      .from("department_admin_permissions")
      .delete()
      .eq("user_id", userId);
  }

  await writeAuditLog(profile, {
    action: "user.update",
    targetType: "user",
    targetId: userId,
    department,
    metadata: {
      role,
      previousRole: existing.role,
      previousDepartment: existing.department,
      ...(emailChanged
        ? { emailChanged: true, previousEmail, email }
        : {}),
    },
  });

  revalidatePath("/users");
  revalidatePath("/departments");
  if (userId === profile.id) revalidatePath("/profile");
  return { success: true, userId };
}

export async function setUserStatus(
  userId: string,
  status: "active" | "inactive" | "archived"
): Promise<UserActionResult> {
  const auth = await assertSuperAdmin();
  if ("error" in auth) return auth.error;
  const { profile } = auth;

  if (userId === profile.id && status !== "active") {
    return { success: false, error: "You cannot deactivate yourself." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .in("role", [ADMIN_ROLE, DEPARTMENT_ADMIN_ROLE]);

  if (error) return { success: false, error: error.message };

  await writeAuditLog(profile, {
    action: status === "active" ? "user.reactivate" : "user.deactivate",
    targetType: "user",
    targetId: userId,
    metadata: { status },
  });

  revalidatePath("/users");
  return { success: true, userId };
}

export async function resetPortalUserPassword(
  userId: string
): Promise<UserActionResult> {
  const auth = await assertSuperAdmin();
  if ("error" in auth) return auth.error;
  const { profile } = auth;

  if (!userId) return { success: false, error: "User ID is required." };

  const supabase = await createClient();
  const { data: user } = await supabase
    .from("users")
    .select("id, email, role")
    .eq("id", userId)
    .in("role", [ADMIN_ROLE, DEPARTMENT_ADMIN_ROLE])
    .maybeSingle();

  if (!user?.email) {
    return {
      success: false,
      error: "Portal user not found. Only admin accounts can be reset here.",
    };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      success: false,
      error:
        "Server is missing SUPABASE_SERVICE_ROLE_KEY. Add it to your environment variables.",
    };
  }

  const tempPassword = generateTempPassword();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: tempPassword,
  });
  if (error) {
    return {
      success: false,
      error: error.message ?? "Failed to reset password.",
    };
  }

  await writeAuditLog(profile, {
    action: "user.reset_password",
    targetType: "user",
    targetId: userId,
    metadata: { email: user.email, role: user.role },
  });

  return { success: true, tempPassword, userId };
}

export async function updateDepartmentAdminPermissions(
  userId: string,
  permissions: PermissionKey[]
): Promise<UserActionResult> {
  const auth = await assertSuperAdmin();
  if ("error" in auth) return auth.error;
  const { profile } = auth;

  const supabase = await createClient();
  const { data: user } = await supabase
    .from("users")
    .select("id, role, department")
    .eq("id", userId)
    .maybeSingle();

  if (!user || user.role !== DEPARTMENT_ADMIN_ROLE) {
    return { success: false, error: "Target is not a department admin." };
  }

  const keys = permissions.filter(isPermissionKey);
  const permError = await savePermissions(userId, keys, profile);
  if (permError) return { success: false, error: permError };

  revalidatePath("/users");
  revalidatePath("/departments");
  return { success: true, userId };
}

export async function requireUsersManager() {
  const profile = await getPortalProfile();
  if (!profile || profile.role !== ADMIN_ROLE) {
    return forbiddenResult("Only super admins can manage users.");
  }
  return null;
}
