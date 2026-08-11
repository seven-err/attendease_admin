import { createClient } from "@/lib/supabase/server";

export type SchoolRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};

export type DepartmentRow = {
  code: string;
  name: string;
  status: "active" | "inactive" | "archived";
  description: string | null;
  school_id: string;
  school_name?: string | null;
  school_code?: string | null;
  created_at: string;
  updated_at: string;
  admin_count?: number;
  student_count?: number;
  checker_count?: number;
};

export async function listSchools(includeArchived = true): Promise<SchoolRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("schools")
    .select("id, code, name, description, status, created_at, updated_at")
    .order("name");

  if (!includeArchived) {
    query = query.eq("status", "active");
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as SchoolRow[];
}

export async function listDepartmentsDetailed(): Promise<DepartmentRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("departments")
    .select(
      `
      code,
      name,
      status,
      description,
      school_id,
      created_at,
      updated_at,
      schools ( code, name )
    `
    )
    .order("code");

  if (error) throw new Error(error.message);

  const departments = (data ?? []).map((row) => {
    const school = Array.isArray(row.schools) ? row.schools[0] : row.schools;
    return {
      code: row.code,
      name: row.name,
      status: row.status,
      description: row.description,
      school_id: row.school_id,
      school_name: school?.name ?? null,
      school_code: school?.code ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    } as DepartmentRow;
  });

  const codes = departments.map((d) => d.code);
  if (!codes.length) return departments;

  const [{ data: admins }, { data: academics }, { data: staff }, { data: checkers }] =
    await Promise.all([
      supabase
        .from("users")
        .select("department")
        .eq("role", "department_admin")
        .in("department", codes),
      supabase
        .from("student_academic_records")
        .select("department")
        .in("department", codes),
      supabase
        .from("staff_assignments")
        .select("department")
        .eq("status", "active")
        .in("department", codes),
      supabase
        .from("users")
        .select("department")
        .eq("role", "attendance_checker")
        .in("department", codes),
    ]);

  const countBy = (rows: { department: string | null }[] | null) => {
    const map = new Map<string, number>();
    for (const row of rows ?? []) {
      if (!row.department) continue;
      map.set(row.department, (map.get(row.department) ?? 0) + 1);
    }
    return map;
  };

  const adminCounts = countBy(admins);
  const studentCounts = countBy(academics);
  const staffCounts = countBy(staff);
  const checkerCounts = countBy(checkers);

  return departments.map((dept) => {
    const students = studentCounts.get(dept.code) ?? 0;
    const staffMembers = staffCounts.get(dept.code) ?? 0;
    return {
      ...dept,
      admin_count: adminCounts.get(dept.code) ?? 0,
      student_count: students + staffMembers,
      checker_count: checkerCounts.get(dept.code) ?? 0,
    };
  });
}
