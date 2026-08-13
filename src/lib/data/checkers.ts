import { CheckerProfileRow, CheckerRow } from "@/lib/attendeaseTypes";
import { CHECKER_ROLE, DEPARTMENTS, EMPLOYEE_LABEL } from "@/lib/constants";
import {
  buildPaginatedResult,
  getRange,
  type PaginatedResult,
} from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import { PIN_UNDO_WINDOW_MS } from "@/lib/checker-pin";

type CheckerDbRow = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: CheckerRow["status"];
  department?: string | null;
  checker_scope?: string | null;
};

type CheckerProfileDbRow = {
  id: string;
  account_id: string;
  display_name: string;
  profile_role: string;
  status: string;
  setup_completed_at: string | null;
  previous_pin_hash: string | null;
  previous_pin_salt: string | null;
  pin_reset_at: string | null;
};

function mapCheckerScope(
  scope: string | null | undefined
): CheckerRow["checker_scope"] {
  if (scope === "ssg") return "ssg";
  if (scope === "employee") return "employee";
  return "department";
}

function mapProfileRole(
  role: string | null | undefined
): CheckerProfileRow["profile_role"] {
  return role === "moderator" ? "moderator" : "checker";
}

function mapProfileStatus(
  status: string | null | undefined
): CheckerProfileRow["status"] {
  return status === "inactive" ? "inactive" : "active";
}

function sortProfiles(a: CheckerProfileRow, b: CheckerProfileRow): number {
  if (a.profile_role !== b.profile_role) {
    return a.profile_role === "moderator" ? -1 : 1;
  }
  return a.display_name.localeCompare(b.display_name, undefined, {
    sensitivity: "base",
  });
}

function mapCheckerRow(
  row: CheckerDbRow,
  canRestorePreviousPin = false,
  profiles: CheckerProfileRow[] = []
): CheckerRow {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    department: row.department ?? null,
    checker_scope: mapCheckerScope(row.checker_scope),
    status: row.status,
    canRestorePreviousPin,
    profiles,
  };
}

/**
 * Load every checker_profiles row for the given accounts.
 * Does not filter by profile_role — moderator and checker are both included.
 * RLS still scopes department admins to their department accounts.
 */
async function profilesByAccountId(
  accountIds: string[]
): Promise<Map<string, CheckerProfileRow[]>> {
  const map = new Map<string, CheckerProfileRow[]>();
  if (!accountIds.length) return map;

  const supabase = await createClient();
  const cutoffIso = new Date(Date.now() - PIN_UNDO_WINDOW_MS).toISOString();
  const { data, error } = await supabase
    .from("checker_profiles")
    .select(
      "id, account_id, display_name, profile_role, status, setup_completed_at, previous_pin_hash, previous_pin_salt, pin_reset_at"
    )
    .in("account_id", accountIds);

  if (error || !data) return map;

  for (const row of data as CheckerProfileDbRow[]) {
    const canRestorePreviousPin =
      Boolean(row.previous_pin_hash && row.previous_pin_salt) &&
      Boolean(row.pin_reset_at) &&
      row.pin_reset_at! >= cutoffIso;
    const profile: CheckerProfileRow = {
      id: row.id,
      display_name: row.display_name,
      profile_role: mapProfileRole(row.profile_role),
      status: mapProfileStatus(row.status),
      setup_completed: Boolean(row.setup_completed_at),
      canRestorePreviousPin,
    };
    const list = map.get(row.account_id) ?? [];
    list.push(profile);
    map.set(row.account_id, list);
  }

  for (const [accountId, list] of map) {
    map.set(accountId, [...list].sort(sortProfiles));
  }

  return map;
}

async function restorablePinAccountIds(
  accountIds: string[]
): Promise<Set<string>> {
  if (!accountIds.length) return new Set();

  const supabase = await createClient();
  const cutoffIso = new Date(Date.now() - PIN_UNDO_WINDOW_MS).toISOString();
  const { data, error } = await supabase
    .from("checker_profiles")
    .select("account_id")
    .in("account_id", accountIds)
    .not("previous_pin_hash", "is", null)
    .not("previous_pin_salt", "is", null)
    .gte("pin_reset_at", cutoffIso);

  if (error || !data) return new Set();

  return new Set(data.map((row) => row.account_id).filter(Boolean));
}

const CHECKER_SELECT =
  "id, full_name, email, role, status, department, checker_scope";

export type CheckersQueryParams = {
  page: number;
  pageSize: number;
  search?: string;
  department?: string;
};

export async function getCheckersPaginated(
  params: CheckersQueryParams
): Promise<PaginatedResult<CheckerRow>> {
  const supabase = await createClient();
  const { page, pageSize } = params;
  const search = params.search?.trim() ?? "";
  const department = params.department?.trim() ?? "all";

  let query = supabase
    .from("users")
    .select(CHECKER_SELECT, { count: "exact" })
    .eq("role", CHECKER_ROLE)
    .order("full_name", { ascending: true });

  if (department === "ssg") {
    query = query.eq("checker_scope", "ssg");
  } else if (department === "employee" || department === EMPLOYEE_LABEL) {
    query = query.eq("checker_scope", "employee");
  } else if (department !== "all") {
    // Department filter is exact — campus-wide SSG/Employee checkers use their own filters.
    query = query.eq("department", department).eq("checker_scope", "department");
  }

  if (search) {
    const pattern = `%${search}%`;
    query = query.or(`full_name.ilike.${pattern},email.ilike.${pattern}`);
  }

  const { from, to } = getRange(page, pageSize);
  let { data, error, count } = await query.range(from, to);

  if (
    error?.message?.includes("department") ||
    error?.message?.includes("checker_scope")
  ) {
    let fallback = supabase
      .from("users")
      .select("id, full_name, email, role, status", { count: "exact" })
      .eq("role", CHECKER_ROLE)
      .order("full_name", { ascending: true });

    if (search) {
      const pattern = `%${search}%`;
      fallback = fallback.or(`full_name.ilike.${pattern},email.ilike.${pattern}`);
    }

    const fallbackResult = await fallback.range(from, to);
    const fallbackRows = fallbackResult.data ?? [];

    data = fallbackRows.map((row) => ({
      ...row,
      department: null,
      checker_scope: "department",
    }));
    error = fallbackResult.error;
    count = fallbackResult.count;
  }

  if (error || !data) {
    return buildPaginatedResult([], 0, page, pageSize);
  }

  const total = count ?? 0;
  const dbRows = data as CheckerDbRow[];
  const accountIds = dbRows.map((row) => row.id);
  const [restorable, profilesMap] = await Promise.all([
    restorablePinAccountIds(accountIds),
    profilesByAccountId(accountIds),
  ]);
  const items = dbRows.map((row) =>
    mapCheckerRow(row, restorable.has(row.id), profilesMap.get(row.id) ?? [])
  );
  const safeResult = buildPaginatedResult(items, total, page, pageSize);

  if (safeResult.page !== page && total > 0) {
    return getCheckersPaginated({
      ...params,
      page: safeResult.page,
    });
  }

  return safeResult;
}

export async function getCheckers(): Promise<CheckerRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("users")
    .select(CHECKER_SELECT)
    .eq("role", CHECKER_ROLE)
    .order("full_name", { ascending: true });

  if (
    error?.message?.includes("department") ||
    error?.message?.includes("checker_scope")
  ) {
    const fallback = await supabase
      .from("users")
      .select("id, full_name, email, role, status")
      .eq("role", CHECKER_ROLE)
      .order("full_name", { ascending: true });
    const fallbackRows = (fallback.data ?? []) as CheckerDbRow[];
    const accountIds = fallbackRows.map((row) => row.id);
    const [restorable, profilesMap] = await Promise.all([
      restorablePinAccountIds(accountIds),
      profilesByAccountId(accountIds),
    ]);
    return fallbackRows.map((row) =>
      mapCheckerRow(
        { ...row, department: null, checker_scope: "department" },
        restorable.has(row.id),
        profilesMap.get(row.id) ?? []
      )
    );
  }

  if (error || !data) return [];

  const dbRows = data as CheckerDbRow[];
  const accountIds = dbRows.map((row) => row.id);
  const [restorable, profilesMap] = await Promise.all([
    restorablePinAccountIds(accountIds),
    profilesByAccountId(accountIds),
  ]);
  return dbRows.map((row) =>
    mapCheckerRow(row, restorable.has(row.id), profilesMap.get(row.id) ?? [])
  );
}

export type SessionCheckerOption = {
  id: string;
  full_name: string;
  department: string | null;
};

export async function getActiveCheckersForSessions(
  department?: string | null
): Promise<SessionCheckerOption[]> {
  const supabase = await createClient();
  const scoped = department?.trim() || null;

  let query = supabase
    .from("users")
    .select("id, full_name, department")
    .eq("role", CHECKER_ROLE)
    .eq("status", "active")
    .order("full_name", { ascending: true });

  // Department admins only assign checkers from their own department
  // (not campus-wide SSG / Employee accounts).
  if (scoped) {
    query = query.eq("department", scoped).eq("checker_scope", "department");
  }

  const { data, error } = await query;

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    full_name: row.full_name,
    department: row.department ?? null,
  }));
}

export async function getDepartmentsForCheckers(): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("student_academic_records")
    .select("department")
    .not("department", "is", null);

  if (error) {
    return [...DEPARTMENTS];
  }

  const unique = new Set<string>();
  for (const row of data ?? []) {
    if (row.department) unique.add(row.department);
  }

  if (unique.size === 0) return [...DEPARTMENTS];

  return [...unique].sort();
}
