"use server";

import { revalidatePath } from "next/cache";
import { getPortalProfile, requireSuperAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/admin/audit";
import { getAppSettings, saveAppSettings } from "@/lib/data/settings";
import {
  parseSettingsForm,
  validateSettingsInput,
} from "@/lib/settings";

export type SettingsActionResult =
  | { success: true }
  | { success: false; error: string };

export async function getSettingsPageData() {
  const profile = await getPortalProfile();
  const settings = await getAppSettings();

  return {
    profile,
    settings,
  };
}

export async function updateAppSettings(
  formData: FormData
): Promise<SettingsActionResult> {
  let profile;
  try {
    profile = await requireSuperAdmin();
  } catch {
    return {
      success: false,
      error: "You don't have permission to manage system settings.",
    };
  }

  const input = parseSettingsForm(formData);
  const validationError = validateSettingsInput(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const result = await saveAppSettings(input);
  if (!result.success) {
    return result;
  }

  await writeAuditLog(profile, {
    action: "system_settings_updated",
    targetType: "app_settings",
    metadata: { keys: Object.keys(input) },
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: true };
}
