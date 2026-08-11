import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { getSettingsPageData } from "./actions";
import { SettingsForm } from "./SettingsForm";
import { getPortalProfile } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/permissions";

export default async function SettingsPage() {
  const profile = await getPortalProfile();
  if (!isSuperAdmin(profile)) {
    redirect("/dashboard");
  }

  const { settings } = await getSettingsPageData();

  return (
    <div className="space-y-4">
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="Settings"
          description="Institution configuration and QR sheet links"
        />
      </div>

      <SettingsForm settings={settings} profile={profile} />
    </div>
  );
}
