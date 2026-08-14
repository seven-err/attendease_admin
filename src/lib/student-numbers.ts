import { createClient } from "@/lib/supabase/server";

const STUDENT_NUMBER_PAGE_SIZE = 1000;

export function studentNumberYearPrefix(academicYear: string): string {
  return academicYear.split("-")[0] || String(new Date().getFullYear());
}

export function isValidStudentNumberForYear(
  studentNumber: string,
  academicYear: string
): boolean {
  const yearPrefix = studentNumberYearPrefix(academicYear);
  return new RegExp(`^${yearPrefix}-\\d+$`).test(studentNumber.trim());
}

export function nextStudentNumber(
  academicYear: string,
  existingNumbers: string[],
  reservedNumbers: Set<string>
): string {
  const yearPrefix = studentNumberYearPrefix(academicYear);
  const pattern = new RegExp(`^${yearPrefix}-(\\d+)$`);
  let max = 0;

  for (const number of [...existingNumbers, ...reservedNumbers]) {
    const match = pattern.exec(number);
    if (!match) continue;
    max = Math.max(max, Number(match[1]));
  }

  return `${yearPrefix}-${String(max + 1).padStart(4, "0")}`;
}

export async function isStudentNumberTaken(
  studentNumber: string,
  excludeId?: string
): Promise<boolean> {
  const supabase = await createClient();
  let studentQuery = supabase
    .from("students")
    .select("id")
    .eq("student_number", studentNumber);

  if (excludeId) {
    studentQuery = studentQuery.neq("id", excludeId);
  }

  const { data: studentMatch } = await studentQuery.maybeSingle();
  if (studentMatch) return true;

  let peopleQuery = supabase
    .from("people")
    .select("id")
    .eq("person_number", studentNumber)
    .eq("person_kind", "student");

  if (excludeId) {
    peopleQuery = peopleQuery.neq("id", excludeId);
  }

  const { data: peopleMatch } = await peopleQuery.maybeSingle();
  if (!peopleMatch) return false;

  // Orphan people rows (no linked student) are reusable by the DB trigger.
  let linkedStudentQuery = supabase
    .from("students")
    .select("id")
    .eq("id", peopleMatch.id);

  if (excludeId) {
    linkedStudentQuery = linkedStudentQuery.neq("id", excludeId);
  }

  const { data: linkedStudent } = await linkedStudentQuery.maybeSingle();
  return Boolean(linkedStudent);
}

function isStudentNumberConflictMessage(message: string | undefined): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes("already exists") ||
    normalized.includes("duplicate key") ||
    normalized.includes("unique constraint")
  );
}

export { isStudentNumberConflictMessage };

async function fetchPaginatedColumnValues(
  table: "students" | "people",
  column: "student_number" | "person_number",
  pattern: string,
  filters?: { person_kind?: string }
): Promise<string[]> {
  const supabase = await createClient();
  const values: string[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from(table)
      .select(column)
      .like(column, pattern)
      .order(column, { ascending: true })
      .range(from, from + STUDENT_NUMBER_PAGE_SIZE - 1);

    if (filters?.person_kind) {
      query = query.eq("person_kind", filters.person_kind);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message ?? `Failed to load ${column} values.`);
    }

    const pageValues = (data ?? [])
      .map((row) => (row as Record<string, string | null>)[column])
      .filter((value): value is string => Boolean(value));

    values.push(...pageValues);

    if (pageValues.length < STUDENT_NUMBER_PAGE_SIZE) {
      break;
    }

    from += STUDENT_NUMBER_PAGE_SIZE;
  }

  return values;
}

export async function getExistingStudentNumbers(
  academicYear: string
): Promise<string[]> {
  const yearPrefix = studentNumberYearPrefix(academicYear);
  const pattern = `${yearPrefix}-%`;

  const [studentNumbers, peopleNumbers] = await Promise.all([
    fetchPaginatedColumnValues("students", "student_number", pattern),
    fetchPaginatedColumnValues("people", "person_number", pattern, {
      person_kind: "student",
    }),
  ]);

  return [...new Set([...studentNumbers, ...peopleNumbers])];
}

export async function resolveStudentNumber(
  academicYear: string,
  existingNumbers: string[],
  reservedNumbers: Set<string>,
  preferredNumber?: string
): Promise<string> {
  const trimmedPreferred = preferredNumber?.trim();
  const workingExisting = [...existingNumbers];
  const workingReserved = new Set(reservedNumbers);

  if (
    trimmedPreferred &&
    isValidStudentNumberForYear(trimmedPreferred, academicYear) &&
    !(await isStudentNumberTaken(trimmedPreferred))
  ) {
    return trimmedPreferred;
  }

  for (let attempt = 0; attempt < 10_000; attempt += 1) {
    const candidate = nextStudentNumber(
      academicYear,
      workingExisting,
      workingReserved
    );

    if (await isStudentNumberTaken(candidate)) {
      workingReserved.add(candidate);
      if (!workingExisting.includes(candidate)) {
        workingExisting.push(candidate);
      }
      continue;
    }

    return candidate;
  }

  throw new Error("Unable to allocate a unique student number.");
}
