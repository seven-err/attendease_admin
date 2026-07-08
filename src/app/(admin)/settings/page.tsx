import { PageHeader } from "@/components/ui/PageHeader";
import { getSettingsPageData } from "./actions";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const { profile, settings } = await getSettingsPageData();

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
