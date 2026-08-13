"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/admin/audit";
import { getPortalProfile } from "@/lib/auth";
import { ADMIN_ROLE } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ProfileActionResult =
  | { success: true }
  | { success: false; error: string };

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function changeOwnPassword(
  formData: FormData
): Promise<ProfileActionResult> {
  const profile = await getPortalProfile();
  if (!profile) {
    return { success: false, error: "You must be signed in to change your password." };
  }

  const currentPassword = String(formData.get("current_password") ?? "");
  const newPassword = String(formData.get("new_password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { success: false, error: "All password fields are required." };
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      success: false,
      error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }
  if (newPassword !== confirmPassword) {
    return { success: false, error: "New passwords do not match." };
  }
  if (currentPassword === newPassword) {
    return {
      success: false,
      error: "New password must be different from your current password.",
    };
  }
  if (!profile.email) {
    return { success: false, error: "Your account is missing an email address." };
  }

  const supabase = await createClient();

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: currentPassword,
  });
  if (verifyError) {
    return { success: false, error: "Current password is incorrect." };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (updateError) {
    return {
      success: false,
      error: updateError.message ?? "Failed to update password.",
    };
  }

  await writeAuditLog(profile, {
    action: "user.change_password",
    targetType: "user",
    targetId: profile.id,
    metadata: { self: true },
  });

  return { success: true };
}

/** Super admins can update their own login email from Profile. */
export async function changeOwnEmail(
  formData: FormData
): Promise<ProfileActionResult> {
  const profile = await getPortalProfile();
  if (!profile || profile.role !== ADMIN_ROLE) {
    return {
      success: false,
      error: "Only super admins can change their email from Profile.",
    };
  }
  if (!profile.email) {
    return { success: false, error: "Your account is missing an email address." };
  }

  const newEmail = String(formData.get("new_email") ?? "").trim().toLowerCase();
  const currentPassword = String(formData.get("current_password") ?? "");

  if (!newEmail || !currentPassword) {
    return { success: false, error: "Email and current password are required." };
  }
  if (!EMAIL_RE.test(newEmail)) {
    return { success: false, error: "Enter a valid email address." };
  }

  const previousEmail = profile.email.trim().toLowerCase();
  if (newEmail === previousEmail) {
    return { success: false, error: "New email must be different from your current email." };
  }

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: previousEmail,
    password: currentPassword,
  });
  if (verifyError) {
    return { success: false, error: "Current password is incorrect." };
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

  const { error: authError } = await admin.auth.admin.updateUserById(
    profile.id,
    {
      email: newEmail,
      email_confirm: true,
    }
  );
  if (authError) {
    return {
      success: false,
      error: authError.message ?? "Failed to update auth email.",
    };
  }

  const { error: profileError } = await admin
    .from("users")
    .update({
      email: newEmail,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id)
    .eq("role", ADMIN_ROLE);

  if (profileError) {
    return {
      success: false,
      error: profileError.message ?? "Failed to update profile email.",
    };
  }

  await writeAuditLog(profile, {
    action: "user.update",
    targetType: "user",
    targetId: profile.id,
    metadata: {
      self: true,
      emailChanged: true,
      previousEmail,
      email: newEmail,
    },
  });

  revalidatePath("/profile");
  revalidatePath("/users");
  return { success: true };
}
