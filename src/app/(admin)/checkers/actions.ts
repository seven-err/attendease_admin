"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAdminProfile } from "@/lib/auth";
import { CHECKER_ROLE, CHECKER_DEPARTMENTS, SSG_LABEL } from "@/lib/constants";

export type CheckerActionResult =
  | { success: true; tempPassword?: string }
  | { success: false; error: string };

async function requireAdmin(): Promise<CheckerActionResult | null> {
  const profile = await getAdminProfile();
  if (!profile) {
    return { success: false, error: "Unauthorized. Admin access required." };
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
  checker_scope: "department" | "ssg";
  department: string | null;
} | null {
  const full_name = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const departmentRaw = String(formData.get("department") ?? "").trim();

  if (!full_name) return null;
  if (!email) return null;
  if (!departmentRaw || !isCheckerDepartment(departmentRaw)) return null;

  const isSsg = departmentRaw === SSG_LABEL;

  return {
    full_name,
    email,
    checker_scope: isSsg ? "ssg" : "department",
    department: isSsg ? null : departmentRaw,
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

export async function createChecker(
  formData: FormData
): Promise<CheckerActionResult> {
  const authError = await requireAdmin();
  if (authError) return authError;

  const parsed = parseCheckerForm(formData);
  if (!parsed) {
    return { success: false, error: "Please complete all required fields." };
  }

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
  });

  if (profileError) {
    await adminClient.auth.admin.deleteUser(userId);
    return {
      success: false,
      error: profileError.message ?? "Failed to create checker profile.",
    };
  }

  revalidatePath("/checkers");
  return { success: true, tempPassword };
}

export async function updateChecker(
  checkerId: string,
  formData: FormData
): Promise<CheckerActionResult> {
  const authError = await requireAdmin();
  if (authError) return authError;
  if (!checkerId) return { success: false, error: "Checker ID is required." };

  const parsed = parseCheckerForm(formData);
  if (!parsed) {
    return { success: false, error: "Please complete all required fields." };
  }

  // Keep email immutable (auth password/reset flow is out of scope here).
  const supabase = await createClient();

  const { error: profileError } = await supabase
    .from("users")
    .update({
      full_name: parsed.full_name,
      department: parsed.department,
      checker_scope: parsed.checker_scope,
    })
    .eq("id", checkerId);

  if (profileError) {
    return {
      success: false,
      error: profileError.message ?? "Failed to update checker.",
    };
  }

  revalidatePath("/checkers");
  return { success: true };
}

export async function archiveChecker(
  checkerId: string
): Promise<CheckerActionResult> {
  const authError = await requireAdmin();
  if (authError) return authError;
  if (!checkerId) return { success: false, error: "Checker ID is required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({ status: "archived" })
    .eq("id", checkerId);

  if (error) {
    return { success: false, error: error.message ?? "Failed to archive." };
  }

  revalidatePath("/checkers");
  return { success: true };
}

export async function toggleCheckerActive(
  checkerId: string
): Promise<CheckerActionResult> {
  const authError = await requireAdmin();
  if (authError) return authError;
  if (!checkerId) return { success: false, error: "Checker ID is required." };

  const supabase = await createClient();
  const { data: row, error: getError } = await supabase
    .from("users")
    .select("status")
    .eq("id", checkerId)
    .maybeSingle();

  if (getError) {
    return {
      success: false,
      error: getError.message ?? "Failed to load checker.",
    };
  }

  const nextStatus =
    row?.status === "active" ? "inactive" : row?.status === "inactive" ? "active" : "active";

  const { error: updateError } = await supabase
    .from("users")
    .update({ status: nextStatus })
    .eq("id", checkerId);

  if (updateError) {
    return {
      success: false,
      error: updateError.message ?? "Failed to update status.",
    };
  }

  revalidatePath("/checkers");
  return { success: true };
}

