import { StudentWithAcademic } from "@/lib/attendeaseTypes";
import {
  buildPaginatedResult,
  getRange,
  type PaginatedResult,
} from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

type AcademicRecordRow = {
  id: string;
  student_id: string;
  department: string;
  course: string;
  year_level: string;
  academic_year: string;
  created_at: string;
};

type StudentWithAcademicRows = {
  id: string;
  student_number: string;
  full_name: string;
  student_status: StudentWithAcademic["student_status"];
  qr_token: string;
  created_at: string;
  updated_at: string;
  student_academic_records: AcademicRecordRow[] | AcademicRecordRow | null;
};

const ACADEMIC_FIELDS = `
    id,
    student_id,
    department,
    course,
    year_level,
    academic_year,
    created_at
`;

function buildStudentSelect(innerAcademic: boolean): string {
  const academicRelation = innerAcademic
    ? `student_academic_records!inner (${ACADEMIC_FIELDS})`
    : `student_academic_records (${ACADEMIC_FIELDS})`;

  return `
  id,
  student_number,
  full_name,
  student_status,
  qr_token,
  created_at,
  updated_at,
  ${academicRelation}
`;
}

function pickLatestAcademicRecord(
  records: AcademicRecordRow[] | AcademicRecordRow | null | undefined
): AcademicRecordRow | undefined {
  const list = Array.isArray(records)
    ? records
    : records
      ? [records]
      : [];

  return list.reduce<AcademicRecordRow | undefined>((latest, record) => {
    if (!latest || record.created_at > latest.created_at) {
      return record;
    }
    return latest;
  }, undefined);
}

function mapStudentRows(
  students: StudentWithAcademicRows[]
): StudentWithAcademic[] {
  return students.map((student) => {
    const academic = pickLatestAcademicRecord(student.student_academic_records);
    const { student_academic_records: _records, ...studentFields } = student;

    return {
      ...studentFields,
      academic_record_id: academic?.id ?? null,
      department: academic?.department ?? null,
      course: academic?.course ?? null,
      year_level: academic?.year_level ?? null,
      academic_year: academic?.academic_year ?? null,
    };
  });
}

export type StudentsQueryParams = {
  page: number;
  pageSize: number;
  search?: string;
  department?: string;
  yearLevel?: string;
};

export async function getStudentsPaginated(
  params: StudentsQueryParams
): Promise<PaginatedResult<StudentWithAcademic>> {
  const supabase = await createClient();
  const { page, pageSize } = params;
  const search = params.search?.trim() ?? "";
  const dept = params.department?.trim() ?? "all";
  const year = params.yearLevel?.trim() ?? "all";
  const hasAcademicFilter =
    (Boolean(dept) && dept !== "all") || (Boolean(year) && year !== "all");

  // Filter via !inner instead of collecting every matching UUID into `.in()`.
  // Large departments (400+ students) made the old `.in()` URL fail and return an empty list.
  let query = supabase
    .from("students")
    .select(buildStudentSelect(hasAcademicFilter), { count: "exact" })
    .order("student_number", { ascending: true });

  if (dept && dept !== "all") {
    query = query.eq("student_academic_records.department", dept);
  }

  if (year && year !== "all") {
    query = query.eq("student_academic_records.year_level", year);
  }

  if (search) {
    const pattern = `%${search}%`;
    query = query.or(
      `student_number.ilike.${pattern},full_name.ilike.${pattern}`
    );
  }

  const { from, to } = getRange(page, pageSize);
  const { data, error, count } = await query.range(from, to);

  if (error || !data) {
    return buildPaginatedResult([], 0, page, pageSize);
  }

  const total = count ?? 0;
  const safeResult = buildPaginatedResult(
    mapStudentRows(data as StudentWithAcademicRows[]),
    total,
    page,
    pageSize
  );

  if (safeResult.page !== page && total > 0) {
    return getStudentsPaginated({
      ...params,
      page: safeResult.page,
    });
  }

  return safeResult;
}

export async function getStudents(): Promise<StudentWithAcademic[]> {
  const supabase = await createClient();

  const { data: students, error } = await supabase
    .from("students")
    .select(buildStudentSelect(false))
    .order("student_number", { ascending: true });

  if (error || !students?.length) return [];

  return mapStudentRows(students as StudentWithAcademicRows[]);
}

export async function getStudentCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true });
  return count ?? 0;
}
