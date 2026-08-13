"use server";

import { writeAuditLog } from "@/lib/admin/audit";
import { getPortalProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ProfileActionResult =
  | { success: true }
  | { success: false; error: string };

const MIN_PASSWORD_LENGTH = 8;

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
