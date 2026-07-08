import { getActiveCheckersForSessions } from "@/lib/data/checkers";
import { getSessions } from "@/lib/data/sessions";
import { SessionsGrid } from "./SessionsGrid";

export default async function SessionsPage() {
  const [sessions, checkers] = await Promise.all([
    getSessions(),
    getActiveCheckersForSessions(),
  ]);

  return <SessionsGrid sessions={sessions} checkers={checkers} />;
}
