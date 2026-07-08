"use server";

import { revalidatePath } from "next/cache";
import { getAdminProfile } from "@/lib/auth";
import { getAppSettings, saveAppSettings } from "@/lib/data/settings";
import {
  parseSettingsForm,
  validateSettingsInput,
} from "@/lib/settings";

export type SettingsActionResult =
  | { success: true }
  | { success: false; error: string };

export async function getSettingsPageData() {
  const profile = await getAdminProfile();
  const settings = await getAppSettings();

  return {
    profile,
    settings,
  };
}

export async function updateAppSettings(
  formData: FormData
): Promise<SettingsActionResult> {
  const profile = await getAdminProfile();
  if (!profile) {
    return { success: false, error: "Unauthorized. Admin access required." };
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

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: true };
}
