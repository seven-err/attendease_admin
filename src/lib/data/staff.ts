import { StaffWithAssignment } from "@/lib/attendeaseTypes";
import { DEPARTMENTS, STAFF_ORG_UNITS } from "@/lib/constants";
import {
  buildPaginatedResult,
  getRange,
  type PaginatedResult,
} from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

type StaffDbRow = {
  id: string;
  person_number: string;
  full_name: string;
  person_status: string;
  qr_token: string | null;
  created_at: string;
  updated_at: string;
  staff_assignments:
    | {
        department: string;
        job_title: string | null;
        status: string;
        created_at: string;
      }[]
    | {
        department: string;
        job_title: string | null;
        status: string;
        created_at: string;
      }
    | null;
};

const STAFF_SELECT = `
  id,
  person_number,
  full_name,
  person_status,
  qr_token,
  created_at,
  updated_at,
  staff_assignments (
    department,
    job_title,
    status,
    created_at
  )
`;

function pickLatestAssignment(
  assignments: StaffDbRow["staff_assignments"]
): {
  department: string;
  job_title: string | null;
  status: string;
} | undefined {
  const list = Array.isArray(assignments)
    ? assignments
    : assignments
      ? [assignments]
      : [];

  return list.reduce<
    | {
        department: string;
        job_title: string | null;
        status: string;
        created_at: string;
      }
    | undefined
  >((latest, row) => {
    if (!latest || row.created_at > latest.created_at) return row;
    return latest;
  }, undefined);
}

function mapStaffRows(rows: StaffDbRow[]): StaffWithAssignment[] {
  return rows.map((row) => {
    const assignment = pickLatestAssignment(row.staff_assignments);
    return {
      id: row.id,
      person_number: row.person_number,
      full_name: row.full_name,
      person_status: row.person_status,
      qr_token: row.qr_token,
      department: assignment?.department ?? null,
      job_title: assignment?.job_title ?? null,
      assignment_status: assignment?.status ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  });
}

export type StaffQueryParams = {
  page: number;
  pageSize: number;
  search?: string;
  department?: string;
};

export async function getStaffPaginated(
  params: StaffQueryParams
): Promise<PaginatedResult<StaffWithAssignment>> {
  const supabase = await createClient();
  const { page, pageSize } = params;
  const search = params.search?.trim() ?? "";
  const department = params.department?.trim() ?? "all";

  let personIds: string[] | null = null;
  if (department && department !== "all") {
    const { data: assignments } = await supabase
      .from("staff_assignments")
      .select("person_id")
      .eq("department", department);

    personIds = [...new Set((assignments ?? []).map((row) => row.person_id))];
    if (personIds.length === 0) {
      return buildPaginatedResult([], 0, page, pageSize);
    }
  }

  let query = supabase
    .from("people")
    .select(STAFF_SELECT, { count: "exact" })
    .eq("person_kind", "staff")
    .order("full_name", { ascending: true });

  if (personIds) {
    query = query.in("id", personIds);
  }

  if (search) {
    const pattern = `%${search}%`;
    query = query.or(
      `full_name.ilike.${pattern},person_number.ilike.${pattern}`
    );
  }

  const { from, to } = getRange(page, pageSize);
  const { data, error, count } = await query.range(from, to);

  if (error || !data) {
    return buildPaginatedResult([], 0, page, pageSize);
  }

  const total = count ?? 0;
  const items = mapStaffRows(data as StaffDbRow[]);
  const safeResult = buildPaginatedResult(items, total, page, pageSize);

  if (safeResult.page !== page && total > 0) {
    return getStaffPaginated({
      ...params,
      page: safeResult.page,
    });
  }

  return safeResult;
}

export async function getStaffDepartments(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_assignments")
    .select("department")
    .not("department", "is", null);

  if (error) {
    return [...DEPARTMENTS, ...STAFF_ORG_UNITS];
  }

  const unique = new Set<string>([...DEPARTMENTS, ...STAFF_ORG_UNITS]);
  for (const row of data ?? []) {
    if (row.department) unique.add(row.department);
  }

  return [...unique].sort();
}
