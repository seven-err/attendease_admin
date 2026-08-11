import { MainSession, MainSessionStatus } from "@/lib/attendeaseTypes";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_MAIN_LIMIT = 100;

type MainSessionRow = {
  id: string;
  name: string;
  description: string | null;
  academic_year: string | null;
  department: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  status: MainSessionStatus | null;
};

export async function getMainSessions(
  limit = DEFAULT_MAIN_LIMIT
): Promise<MainSession[]> {
  const supabase = await createClient();

  const { data: mains, error } = await supabase
    .from("main_sessions")
    .select(
      "id, name, description, academic_year, department, created_by, created_at, updated_at, status"
    )
    .neq("status", "Trashed")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !mains?.length) return [];

  const mainIds = mains.map((main: MainSessionRow) => main.id);
  const { data: subRows } = await supabase
    .from("attendance_sessions")
    .select("main_session_id")
    .in("main_session_id", mainIds)
    .neq("status", "Trashed");

  const counts = new Map<string, number>();
  for (const row of subRows ?? []) {
    if (!row.main_session_id) continue;
    counts.set(
      row.main_session_id,
      (counts.get(row.main_session_id) ?? 0) + 1
    );
  }

  return mains.map((main: MainSessionRow) => ({
    id: main.id,
    name: main.name,
    description: main.description,
    academic_year: main.academic_year,
    department: main.department,
    created_by: main.created_by,
    created_at: main.created_at,
    updated_at: main.updated_at,
    status: main.status ?? "Active",
    sub_session_count: counts.get(main.id) ?? 0,
  }));
}
