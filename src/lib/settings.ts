import { currentAcademicYear } from "@/lib/validations/student";

export const SETTINGS_KEYS = {
  institutionName: "institution_name",
  academicYear: "academic_year",
  qrSheetUrl: "qr_sheet_url",
} as const;

export type AppSettings = {
  institutionName: string;
  academicYear: string;
  qrSheetUrl: string;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  institutionName: "AttendEase",
  academicYear: currentAcademicYear(),
  qrSheetUrl: "",
};

export function mapSettingsRows(
  rows: { key: string; value: string }[]
): AppSettings {
  const map = new Map(rows.map((row) => [row.key, row.value]));

  return {
    institutionName:
      map.get(SETTINGS_KEYS.institutionName) ??
      DEFAULT_APP_SETTINGS.institutionName,
    academicYear:
      map.get(SETTINGS_KEYS.academicYear) ||
      DEFAULT_APP_SETTINGS.academicYear,
    qrSheetUrl: map.get(SETTINGS_KEYS.qrSheetUrl) ?? "",
  };
}

export function parseSettingsForm(formData: FormData): AppSettings {
  return {
    institutionName: String(formData.get("institution_name") ?? "").trim(),
    academicYear: String(formData.get("academic_year") ?? "").trim(),
    qrSheetUrl: String(formData.get("qr_sheet_url") ?? "").trim(),
  };
}

export function validateSettingsInput(
  input: AppSettings
): string | null {
  if (!input.institutionName) {
    return "Institution name is required.";
  }

  if (!input.academicYear) {
    return "Academic year is required.";
  }

  if (input.qrSheetUrl && !isValidHttpUrl(input.qrSheetUrl)) {
    return "QR Google Sheet link must be a valid URL.";
  }

  return null;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
