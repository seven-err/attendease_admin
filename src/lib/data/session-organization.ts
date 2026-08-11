import {
  MainSession,
  MainSessionGroup,
  OrganizedSessions,
  SessionWithStats,
} from "@/lib/attendeaseTypes";

export function organizeSessions(
  sessions: SessionWithStats[],
  mainSessions: MainSession[]
): OrganizedSessions {
  const activeMains = mainSessions.filter(
    (main) => main.status === "Active" || main.status === "Archived"
  );
  const mainById = new Map(activeMains.map((main) => [main.id, main]));
  const subsByMain = new Map<string, SessionWithStats[]>();
  const standalones: SessionWithStats[] = [];

  for (const session of sessions) {
    const parentId = session.main_session_id;
    if (parentId && mainById.has(parentId)) {
      const list = subsByMain.get(parentId) ?? [];
      list.push(session);
      subsByMain.set(parentId, list);
      continue;
    }

    // Orphaned sub-sessions (parent missing/trashed) show as standalone.
    standalones.push({
      ...session,
      main_session_id: parentId && !mainById.has(parentId) ? null : session.main_session_id,
      main_session_name:
        parentId && !mainById.has(parentId) ? null : session.main_session_name,
    });
  }

  const mainGroups: MainSessionGroup[] = activeMains.map((main) => {
    const subs = [...(subsByMain.get(main.id) ?? [])].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.start_time.localeCompare(a.start_time);
    });
    return {
      main: {
        ...main,
        sub_session_count: subs.length,
      },
      subs,
    };
  });

  // Prefer mains with recent activity first, then by name.
  mainGroups.sort((a, b) => {
    const aDate = a.subs[0]?.date ?? a.main.created_at.slice(0, 10);
    const bDate = b.subs[0]?.date ?? b.main.created_at.slice(0, 10);
    if (aDate !== bDate) return bDate.localeCompare(aDate);
    return a.main.name.localeCompare(b.main.name);
  });

  standalones.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.start_time.localeCompare(a.start_time);
  });

  return { mainGroups, standalones };
}

export function sessionOrganizationLabel(
  session: Pick<SessionWithStats, "main_session_id">
): "Sub-session" | "Standalone" {
  return session.main_session_id ? "Sub-session" : "Standalone";
}
