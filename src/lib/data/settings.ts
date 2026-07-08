import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
  mapSettingsRows,
  SETTINGS_KEYS,
} from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";

export async function getAppSettings(): Promise<AppSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("app_settings").select("key, value");

  if (error || !data?.length) {
    return DEFAULT_APP_SETTINGS;
  }

  return mapSettingsRows(data);
}

export async function saveAppSettings(
  settings: AppSettings
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient();
  const rows = [
    { key: SETTINGS_KEYS.institutionName, value: settings.institutionName },
    { key: SETTINGS_KEYS.academicYear, value: settings.academicYear },
    { key: SETTINGS_KEYS.qrSheetUrl, value: settings.qrSheetUrl },
  ];

  const { error } = await supabase.from("app_settings").upsert(
    rows.map((row) => ({
      ...row,
      updated_at: new Date().toISOString(),
    }))
  );

  if (error) {
    return {
      success: false,
      error: error.message ?? "Failed to save settings.",
    };
  }

  return { success: true };
}
