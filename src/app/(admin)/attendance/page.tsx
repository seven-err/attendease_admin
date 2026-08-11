import { redirect } from "next/navigation";
import { getPortalProfile } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listRecentSessions } from "./actions";
import { AttendanceManager } from "./AttendanceManager";

export default async function AttendancePage() {
  const profile = await getPortalProfile();
  if (!profile || !can(profile, "attendance.view")) {
    redirect("/dashboard");
  }

  const sessions = await listRecentSessions(60);

  return (
    <AttendanceManager
      sessions={sessions}
      canEdit={can(profile, "attendance.edit")}
      canVoid={can(profile, "attendance.void")}
      canExport={can(profile, "attendance.export")}
    />
  );
}
