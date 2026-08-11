import { redirect } from "next/navigation";
import { getPortalProfile } from "@/lib/auth";
import { can, scopedDepartment } from "@/lib/permissions";
import { BulkImportWizard } from "./BulkImportWizard";

export default async function ImportPage() {
  const profile = await getPortalProfile();
  if (!profile || !can(profile, "bulk_import.view")) {
    redirect("/dashboard");
  }

  return (
    <BulkImportWizard
      canExecute={can(profile, "bulk_import.execute")}
      scopedDepartment={scopedDepartment(profile)}
    />
  );
}
