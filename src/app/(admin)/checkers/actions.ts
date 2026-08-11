"use server";

import { randomBytes, randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getPortalProfile, type PortalProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/admin/audit";
import { CHECKER_ROLE, CHECKER_DEPARTMENTS, EMPLOYEE_LABEL, SSG_LABEL } from "@/lib/constants";
import {
  can,
  isDepartmentAdmin,
  isSuperAdmin,
  scopedDepartment,
} from "@/lib/permissions";

export type CheckerActionResult =
  | {
      success: true;
      tempPassword?: string;
      tempPin?: string;
      profilesReset?: number;
    }
  | { success: false; error: string };

async function requireCheckerManager(): Promise<
  { profile: PortalProfile } | { error: CheckerActionResult }
> {
  const profile = await getPortalProfile();
  if (!profile || !can(profile, "checkers.manage")) {
    return {
      error: {
        success: false,
        error: "You don't have permission to manage checker accounts.",
      },
    };
  }
  return { profile };
}

function assertCheckerInScope(
  profile: PortalProfile,
  department: string | null,
  checkerScope: "department" | "ssg" | "employee"
): string | null {
  if (!isDepartmentAdmin(profile)) return null;
  if (checkerScope === "ssg" || checkerScope === "employee") {
    return "Department admins cannot create or edit campus-wide checker accounts.";
  }
  const scope = scopedDepartment(profile);
  if (!scope || department !== scope) {
    return "You can only manage checker accounts in your department.";
  }
  return null;
}

function isCheckerDepartment(
  value: string
): value is (typeof CHECKER_DEPARTMENTS)[number] {
  return (CHECKER_DEPARTMENTS as readonly string[]).includes(value);
}

function parseCheckerForm(formData: FormData): {
  full_name: string;
  email: string;
  checker_scope: "department" | "ssg" | "employee";
  department: string | null;
  checker_audience: "student" | "staff" | "both";
} | null {
  const full_name = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const departmentRaw = String(formData.get("department") ?? "").trim();

  if (!full_name) return null;
  if (!email) return null;
  if (!departmentRaw || !isCheckerDepartment(departmentRaw)) return null;

  const isSsg = departmentRaw === SSG_LABEL;
  const isEmployee = departmentRaw === EMPLOYEE_LABEL;

  return {
    full_name,
    email,
    checker_scope: isSsg ? "ssg" : isEmployee ? "employee" : "department",
    department: isSsg || isEmployee ? null : departmentRaw,
    checker_audience: isEmployee ? "staff" : "both",
  };
}

function generateTempPassword(): string {
  // Simple temp password for first-time login.
  // If your auth settings require email confirmation, creation may still succeed
  // but the checker won't be able to sign in until they confirm.
  return randomBytes(18)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 18);
}

function generateTempPin(): string {
  return String(randomInt(0, 10_000)).padStart(4, "0");
}

function checkerScopeFromRow(
  scope: string | null | undefined
): "department" | "ssg" | "employee" {
  if (scope === "ssg") return "ssg";
  if (scope === "employee") return "employee";
  return "department";
}

async function loadCheckerForManage(
  checkerId: string,
  profile: PortalProfile
): Promise<
  | {
      checker: {
        id: string;
        email: string;
        department: string | null;
        checker_scope: string | null;
      };
    }
  | { error: CheckerActionResult }
> {
  const supabase = await createClient();
  const { data: existing, error } = await supabase
    .from("users")
    .select("id, email, department, checker_scope")
    .eq("id", checkerId)
    .eq("role", CHECKER_ROLE)
    .maybeSingle();

  if (error) {
    return {
      error: {
        success: false,
        error: error.message ?? "Failed to load checker.",
      },
    };
  }
  if (!existing) {
    return { error: { success: false, error: "Checker not found." } };
  }

  const scopeError = assertCheckerInScope(
    profile,
    existing.department,
    checkerScopeFromRow(existing.checker_scope)
  );
  if (scopeError) return { error: { success: false, error: scopeError } };

  return { checker: existing };
}

export async function createChecker(
  formData: FormData
): Promise<CheckerActionResult> {
  const auth = await requireCheckerManager();
  if ("error" in auth) return auth.error;
  const { profile } = auth;

  const parsed = parseCheckerForm(formData);
  if (!parsed) {
    return { success: false, error: "Please complete all required fields." };
  }

  const scopeError = assertCheckerInScope(
    profile,
    parsed.department,
    parsed.checker_scope
  );
  if (scopeError) return { success: false, error: scopeError };

  const tempPassword = generateTempPassword();

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    return {
      success: false,
      error:
        "Server is missing SUPABASE_SERVICE_ROLE_KEY. Add it to your environment variables.",
    };
  }

  const { data: authData, error: signUpError } =
    await adminClient.auth.admin.createUser({
      email: parsed.email,
      password: tempPassword,
      email_confirm: true,
    });

  if (signUpError || !authData.user) {
    return {
      success: false,
      error: signUpError?.message ?? "Failed to create auth user.",
    };
  }

  const userId = authData.user.id;

  const { error: profileError } = await adminClient.from("users").insert({
    id: userId,
    full_name: parsed.full_name,
    email: parsed.email,
    role: CHECKER_ROLE,
    status: "active",
    department: parsed.department,
    checker_scope: parsed.checker_scope,
    checker_audience: parsed.checker_audience,
  });

  if (profileError) {
    await adminClient.auth.admin.deleteUser(userId);
    return {
      success: false,
      error: profileError.message ?? "Failed to create checker profile.",
    };
  }

  await writeAuditLog(profile, {
    action: "checker_created",
    targetType: "user",
    targetId: userId,
    department: parsed.department,
    metadata: { email: parsed.email, checker_scope: parsed.checker_scope },
  });

  revalidatePath("/checkers");
  return { success: true, tempPassword };
}

export async function updateChecker(
  checkerId: string,
  formData: FormData
): Promise<CheckerActionResult> {
  const auth = await requireCheckerManager();
  if ("error" in auth) return auth.error;
  const { profile } = auth;
  if (!checkerId) return { success: false, error: "Checker ID is required." };

  const parsed = parseCheckerForm(formData);
  if (!parsed) {
    return { success: false, error: "Please complete all required fields." };
  }

  const loaded = await loadCheckerForManage(checkerId, profile);
  if ("error" in loaded) return loaded.error;
  const { checker: existing } = loaded;

  const scopeError = assertCheckerInScope(
    profile,
    parsed.department,
    parsed.checker_scope
  );
  if (scopeError) return { success: false, error: scopeError };

  const emailChanged =
    parsed.email !== (existing.email ?? "").trim().toLowerCase();
  if (emailChanged && !isSuperAdmin(profile)) {
    return {
      success: false,
      error: "Only super admins can change checker emails.",
    };
  }

  if (emailChanged) {
    let adminClient;
    try {
      adminClient = createAdminClient();
    } catch {
      return {
        success: false,
        error:
          "Server is missing SUPABASE_SERVICE_ROLE_KEY. Add it to your environment variables.",
      };
    }

    const { error: authError } = await adminClient.auth.admin.updateUserById(
      checkerId,
      {
        email: parsed.email,
        email_confirm: true,
      }
    );
    if (authError) {
      return {
        success: false,
        error: authError.message ?? "Failed to update auth email.",
      };
    }

    const { error: emailError } = await adminClient
      .from("users")
      .update({
        full_name: parsed.full_name,
        email: parsed.email,
        department: parsed.department,
        checker_scope: parsed.checker_scope,
        checker_audience: parsed.checker_audience,
      })
      .eq("id", checkerId)
      .eq("role", CHECKER_ROLE);

    if (emailError) {
      return {
        success: false,
        error: emailError.message ?? "Failed to update checker email.",
      };
    }
  } else {
    const supabase = await createClient();
    const { error: profileError } = await supabase
      .from("users")
      .update({
        full_name: parsed.full_name,
        department: parsed.department,
        checker_scope: parsed.checker_scope,
        checker_audience: parsed.checker_audience,
      })
      .eq("id", checkerId)
      .eq("role", CHECKER_ROLE);

    if (profileError) {
      return {
        success: false,
        error: profileError.message ?? "Failed to update checker.",
      };
    }
  }

  await writeAuditLog(profile, {
    action: "checker_updated",
    targetType: "user",
    targetId: checkerId,
    department: parsed.department,
    metadata: emailChanged
      ? { emailChanged: true, previousEmail: existing.email, email: parsed.email }
      : undefined,
  });

  revalidatePath("/checkers");
  return { success: true };
}

export async function resetCheckerPassword(
  checkerId: string
): Promise<CheckerActionResult> {
  const profile = await getPortalProfile();
  if (!profile || !isSuperAdmin(profile)) {
    return {
      success: false,
      error: "Only super admins can reset checker passwords.",
    };
  }
  if (!checkerId) return { success: false, error: "Checker ID is required." };

  const loaded = await loadCheckerForManage(checkerId, profile);
  if ("error" in loaded) return loaded.error;
  const { checker } = loaded;

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    return {
      success: false,
      error:
        "Server is missing SUPABASE_SERVICE_ROLE_KEY. Add it to your environment variables.",
    };
  }

  const tempPassword = generateTempPassword();
  const { error } = await adminClient.auth.admin.updateUserById(checkerId, {
    password: tempPassword,
  });
  if (error) {
    return { success: false, error: error.message ?? "Failed to reset password." };
  }

  await writeAuditLog(profile, {
    action: "checker.reset_password",
    targetType: "user",
    targetId: checkerId,
    department: checker.department,
    metadata: { email: checker.email },
  });

  revalidatePath("/checkers");
  return { success: true, tempPassword };
}

export async function resetCheckerPins(
  checkerId: string
): Promise<CheckerActionResult> {
  const profile = await getPortalProfile();
  if (!profile || !isSuperAdmin(profile)) {
    return {
      success: false,
      error: "Only super admins can reset checker PINs.",
    };
  }
  if (!checkerId) return { success: false, error: "Checker ID is required." };

  const loaded = await loadCheckerForManage(checkerId, profile);
  if ("error" in loaded) return loaded.error;
  const { checker } = loaded;

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    return {
      success: false,
      error:
        "Server is missing SUPABASE_SERVICE_ROLE_KEY. Add it to your environment variables.",
    };
  }

  const { data: profiles, error: listError } = await adminClient
    .from("checker_profiles")
    .select("id")
    .eq("account_id", checkerId);

  if (listError) {
    return {
      success: false,
      error: listError.message ?? "Failed to load checker profiles.",
    };
  }
  if (!profiles?.length) {
    return {
      success: false,
      error: "No checker profiles found for this account.",
    };
  }

  const tempPin = generateTempPin();
  const { data: salt, error: saltError } = await adminClient.rpc(
    "generate_checker_pin_salt"
  );
  if (saltError || typeof salt !== "string" || !salt) {
    return {
      success: false,
      error: saltError?.message ?? "Failed to generate PIN salt.",
    };
  }

  const { data: pinHash, error: hashError } = await adminClient.rpc(
    "hash_checker_pin",
    { p_pin: tempPin, p_salt: salt }
  );
  if (hashError || typeof pinHash !== "string" || !pinHash) {
    return {
      success: false,
      error: hashError?.message ?? "Failed to hash PIN.",
    };
  }

  const now = new Date().toISOString();
  const { error: updateError } = await adminClient
    .from("checker_profiles")
    .update({
      pin_salt: salt,
      pin_hash: pinHash,
      pin_updated_at: now,
      failed_pin_attempts: 0,
      pin_locked_until: null,
      setup_completed_at: now,
    })
    .eq("account_id", checkerId);

  if (updateError) {
    return {
      success: false,
      error: updateError.message ?? "Failed to reset PINs.",
    };
  }

  await writeAuditLog(profile, {
    action: "checker.reset_pins",
    targetType: "user",
    targetId: checkerId,
    department: checker.department,
    metadata: {
      email: checker.email,
      profilesReset: profiles.length,
    },
  });

  revalidatePath("/checkers");
  return {
    success: true,
    tempPin,
    profilesReset: profiles.length,
  };
}

export async function deleteChecker(
  checkerId: string
): Promise<CheckerActionResult> {
  const profile = await getPortalProfile();
  if (!profile || !isSuperAdmin(profile)) {
    return {
      success: false,
      error: "Only super admins can delete checker accounts.",
    };
  }
  if (!checkerId) return { success: false, error: "Checker ID is required." };

  const loaded = await loadCheckerForManage(checkerId, profile);
  if ("error" in loaded) return loaded.error;
  const { checker } = loaded;

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    return {
      success: false,
      error:
        "Server is missing SUPABASE_SERVICE_ROLE_KEY. Add it to your environment variables.",
    };
  }

  await writeAuditLog(profile, {
    action: "checker.deleted",
    targetType: "user",
    targetId: checkerId,
    department: checker.department,
    metadata: {
      email: checker.email,
      checker_scope: checker.checker_scope,
    },
  });

  const { error } = await adminClient.auth.admin.deleteUser(checkerId);
  if (error) {
    return {
      success: false,
      error: error.message ?? "Failed to delete checker.",
    };
  }

  revalidatePath("/checkers");
  return { success: true };
}

export async function toggleCheckerActive(
  checkerId: string
): Promise<CheckerActionResult> {
  const auth = await requireCheckerManager();
  if ("error" in auth) return auth.error;
  const { profile } = auth;
  if (!checkerId) return { success: false, error: "Checker ID is required." };

  const supabase = await createClient();
  const { data: row, error: getError } = await supabase
    .from("users")
    .select("status, department, checker_scope")
    .eq("id", checkerId)
    .eq("role", CHECKER_ROLE)
    .maybeSingle();

  if (getError) {
    return {
      success: false,
      error: getError.message ?? "Failed to load checker.",
    };
  }

  if (!row) {
    return { success: false, error: "Checker not found." };
  }

  const scopeError = assertCheckerInScope(
    profile,
    row.department,
    row.checker_scope === "ssg"
      ? "ssg"
      : row.checker_scope === "employee"
        ? "employee"
        : "department"
  );
  if (scopeError) return { success: false, error: scopeError };

  const nextStatus =
    row.status === "active"
      ? "inactive"
      : row.status === "inactive"
        ? "active"
        : "active";

  const { error: updateError } = await supabase
    .from("users")
    .update({ status: nextStatus })
    .eq("id", checkerId)
    .eq("role", CHECKER_ROLE);

  if (updateError) {
    return {
      success: false,
      error: updateError.message ?? "Failed to update status.",
    };
  }

  await writeAuditLog(profile, {
    action: "checker_status_changed",
    targetType: "user",
    targetId: checkerId,
    department: row.department,
    metadata: { status: nextStatus },
  });

  revalidatePath("/checkers");
  return { success: true };
}

