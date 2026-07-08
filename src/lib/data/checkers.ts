import { CheckerRow } from "@/lib/attendeaseTypes";
import { CHECKER_ROLE, DEPARTMENTS } from "@/lib/constants";
import {
  buildPaginatedResult,
  getRange,
  type PaginatedResult,
} from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

type CheckerDbRow = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: CheckerRow["status"];
  department?: string | null;
  checker_scope?: string | null;
};

function mapCheckerRow(row: CheckerDbRow): CheckerRow {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    department: row.department ?? null,
    checker_scope:
      row.checker_scope === "ssg" ? "ssg" : "department",
    status: row.status,
  };
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
  } else if (department !== "all") {
    query = query.or(`department.eq.${department},checker_scope.eq.ssg`);
  }

  if (search) {
    const pattern = `%${search}%`;
    query = query.or(`full_name.ilike.${pattern},email.ilike.${pattern}`);
  }

  const { from, to } = getRange(page, pageSize);
  let { data, error, count } = await query.range(from, to);

  if (error?.message?.includes("department") || error?.message?.includes("checker_scope")) {
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
  const items = (data as CheckerDbRow[]).map(mapCheckerRow);
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

  if (error?.message?.includes("department") || error?.message?.includes("checker_scope")) {
    const fallback = await supabase
      .from("users")
      .select("id, full_name, email, role, status")
      .eq("role", CHECKER_ROLE)
      .order("full_name", { ascending: true });
    return (fallback.data ?? []).map((row) => ({
      id: row.id,
      full_name: row.full_name,
      email: row.email,
      department: null,
      checker_scope: "department" as const,
      status: row.status,
    }));
  }

  if (error || !data) return [];

  return (data as CheckerDbRow[]).map(mapCheckerRow);
}

export type SessionCheckerOption = {
  id: string;
  full_name: string;
  department: string | null;
};

export async function getActiveCheckersForSessions(): Promise<
  SessionCheckerOption[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, department")
    .eq("role", CHECKER_ROLE)
    .eq("status", "active")
    .order("full_name", { ascending: true });

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
