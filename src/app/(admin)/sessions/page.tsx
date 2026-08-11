import { redirect } from "next/navigation";
import { getPortalProfile } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getActiveCheckersForSessions } from "@/lib/data/checkers";
import { getMainSessions } from "@/lib/data/main-sessions";
import { getSessions } from "@/lib/data/sessions";
import { SessionsGrid } from "./SessionsGrid";

export default async function SessionsPage() {
  const profile = await getPortalProfile();
  if (!profile || !can(profile, "sessions.view")) {
    redirect("/dashboard");
  }

  const [sessions, mainSessions, checkers] = await Promise.all([
    getSessions(),
    getMainSessions(),
    getActiveCheckersForSessions(),
  ]);

  return (
    <SessionsGrid
      sessions={sessions}
      mainSessions={mainSessions}
      checkers={checkers}
    />
  );
}
