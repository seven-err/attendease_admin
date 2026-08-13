import { redirect } from "next/navigation";
import { getPortalProfile } from "@/lib/auth";
import { can, scopedDepartment } from "@/lib/permissions";
import { getActiveCheckersForSessions } from "@/lib/data/checkers";
import { getMainSessions } from "@/lib/data/main-sessions";
import { getSessions } from "@/lib/data/sessions";
import { SessionsGrid } from "./SessionsGrid";

export default async function SessionsPage() {
  const profile = await getPortalProfile();
  if (!profile || !can(profile, "sessions.view")) {
    redirect("/dashboard");
  }

  const scope = scopedDepartment(profile);
  const [sessions, mainSessions, checkers] = await Promise.all([
    getSessions(),
    getMainSessions(),
    getActiveCheckersForSessions(scope),
  ]);

  return (
    <SessionsGrid
      sessions={sessions}
      mainSessions={mainSessions}
      checkers={checkers}
      canExport={can(profile, "attendance.export")}
      canDelete={can(profile, "sessions.delete")}
      scopedDepartment={scope}
    />
  );
}
