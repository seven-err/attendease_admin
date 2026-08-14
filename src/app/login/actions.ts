"use server";

import { PORTAL_ROLES } from "@/lib/constants";
import { isPortalRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type LoginResult =
  | { success: true }
  | { success: false; error: string };

const NETWORK_ERROR =
  "Unable to reach the authentication service. Check your connection and try again.";

export async function login(formData: FormData): Promise<LoginResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { success: false, error: "Email and password are required." };
  }

  const supabase = await createClient();

  let authData: Awaited<
    ReturnType<typeof supabase.auth.signInWithPassword>
  >["data"];
  let authError: Awaited<
    ReturnType<typeof supabase.auth.signInWithPassword>
  >["error"];

  try {
    ({ data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password }));
  } catch {
    return { success: false, error: NETWORK_ERROR };
  }

  if (authError) {
    return { success: false, error: authError.message };
  }

  const userId = authData.user?.id;
  if (!userId) {
    return { success: false, error: "Login failed. Please try again." };
  }

  let profile: {
    role: string;
    status: string;
    department: string | null;
  } | null = null;
  let profileError: { message: string } | null = null;

  try {
    ({ data: profile, error: profileError } = await supabase
      .from("users")
      .select("role, status, department")
      .eq("id", userId)
      .in("role", [...PORTAL_ROLES])
      .maybeSingle());
  } catch {
    await supabase.auth.signOut();
    return { success: false, error: NETWORK_ERROR };
  }

  if (profileError || !profile) {
    await supabase.auth.signOut();
    return {
      success: false,
      error: "Unable to load your profile. Contact an administrator.",
    };
  }

  if (!isPortalRole(profile.role) || profile.status !== "active") {
    await supabase.auth.signOut();
    return { success: false, error: "Access denied. Admin credentials required." };
  }

  if (profile.role === "department_admin" && !profile.department?.trim()) {
    await supabase.auth.signOut();
    return {
      success: false,
      error:
        "Your department admin account is missing a department assignment.",
    };
  }

  return { success: true };
}
