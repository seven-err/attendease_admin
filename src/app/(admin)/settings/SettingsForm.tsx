"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AppUserProfile } from "@/lib/attendeaseTypes";
import { AppSettings } from "@/lib/settings";
import { ExternalLink, Save } from "lucide-react";
import { updateAppSettings } from "./actions";

const inputClass = "input-field";

type SettingsFormProps = {
  settings: AppSettings;
  profile: AppUserProfile | null;
};

export function SettingsForm({ settings, profile }: SettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await updateAppSettings(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }

      setSuccess("Settings saved successfully.");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {success && <p className="alert alert-success">{success}</p>}

      {error && <p className="alert alert-error">{error}</p>}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit(new FormData(event.currentTarget));
        }}
        className="space-y-4"
      >
        <section className="card p-5">
          <h3 className="text-lg font-bold">Institution</h3>
          <p className="mt-1 text-sm text-text-secondary">
            Basic details shown across the admin portal.
          </p>

          <div className="mt-4 space-y-4">
            <div>
              <label className="label-field-sm">
                Institution name
              </label>
              <input
                name="institution_name"
                defaultValue={settings.institutionName}
                placeholder="e.g. AttendEase University"
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className="label-field-sm">
                Default academic year
              </label>
              <input
                name="academic_year"
                defaultValue={settings.academicYear}
                placeholder="e.g. 2025-2026"
                required
                className={inputClass}
              />
              <p className="mt-1 text-xs text-text-muted">
                Used as the default when adding new students.
              </p>
            </div>
          </div>
        </section>

        <section className="card p-5">
          <h3 className="text-lg font-bold">Student QR codes</h3>
          <p className="mt-1 text-sm text-text-secondary">
            QR codes are managed in your Google Sheet. Paste the sheet link here
            so admins can open it quickly. Each student&apos;s{" "}
            <span className="font-mono text-xs">qr_token</span> in the Students
            page should match the value encoded in your sheet QR codes.
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <label className="label-field-sm">
                Google Sheets QR link
              </label>
              <input
                name="qr_sheet_url"
                type="url"
                defaultValue={settings.qrSheetUrl}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className={inputClass}
              />
            </div>

            {settings.qrSheetUrl ? (
              <a
                href={settings.qrSheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="link-brand inline-flex items-center gap-2 text-sm"
              >
                <ExternalLink className="size-4" />
                Open QR Google Sheet
              </a>
            ) : null}
          </div>
        </section>

        <section className="card p-5">
          <h3 className="text-lg font-bold">Your account</h3>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-text-secondary">Name</p>
              <p className="font-bold">{profile?.full_name ?? "—"}</p>
            </div>
            <div>
              <p className="text-text-secondary">Email</p>
              <p className="font-bold">{profile?.email ?? "—"}</p>
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="btn btn-primary"
          >
            <Save className="size-4" />
            {isPending ? "Saving..." : "Save settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
