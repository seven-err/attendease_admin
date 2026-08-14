import { createClient } from "@/lib/supabase/server";

export const STUDENT_NUMBERS_NETWORK_ERROR =
  "Unable to reach the database. Check your connection and try again.";

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

function isFetchFailure(message: string | undefined): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes("fetch failed") ||
    normalized.includes("network") ||
    normalized.includes("timeout") ||
    normalized.includes("econnrefused") ||
    normalized.includes("enotfound")
  );
}

function raiseQueryError(message: string | undefined, context: string): never {
  if (isFetchFailure(message)) {
    throw new Error(STUDENT_NUMBERS_NETWORK_ERROR);
  }
  throw new Error(message ?? `Failed to load ${context}.`);
}

function highestSuffixFromNumber(
  value: string | null | undefined,
  yearPrefix: string
): number {
  if (!value) return 0;
  const match = new RegExp(`^${yearPrefix}-(\\d+)$`).exec(value);
  return match ? Number(match[1]) : 0;
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

  const { data: studentMatch, error: studentError } =
    await studentQuery.maybeSingle();
  if (studentError) {
    raiseQueryError(studentError.message, "student number availability");
  }
  if (studentMatch) return true;

  let peopleQuery = supabase
    .from("people")
    .select("id")
    .eq("person_number", studentNumber)
    .eq("person_kind", "student");

  if (excludeId) {
    peopleQuery = peopleQuery.neq("id", excludeId);
  }

  const { data: peopleMatch, error: peopleError } =
    await peopleQuery.maybeSingle();
  if (peopleError) {
    raiseQueryError(peopleError.message, "student number availability");
  }
  if (!peopleMatch) return false;

  // Orphan people rows (no linked student) are reusable by the DB trigger.
  let linkedStudentQuery = supabase
    .from("students")
    .select("id")
    .eq("id", peopleMatch.id);

  if (excludeId) {
    linkedStudentQuery = linkedStudentQuery.neq("id", excludeId);
  }

  const { data: linkedStudent, error: linkedError } =
    await linkedStudentQuery.maybeSingle();
  if (linkedError) {
    raiseQueryError(linkedError.message, "student number availability");
  }
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

/** Highest assigned number for the academic year — enough for nextStudentNumber(). */
export async function getExistingStudentNumbers(
  academicYear: string
): Promise<string[]> {
  const yearPrefix = studentNumberYearPrefix(academicYear);
  const pattern = `${yearPrefix}-%`;
  const supabase = await createClient();

  const [studentsResult, peopleResult] = await Promise.all([
    supabase
      .from("students")
      .select("student_number")
      .like("student_number", pattern)
      .order("student_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("people")
      .select("person_number")
      .like("person_number", pattern)
      .eq("person_kind", "student")
      .order("person_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (studentsResult.error) {
    raiseQueryError(studentsResult.error.message, "student numbers");
  }
  if (peopleResult.error) {
    raiseQueryError(peopleResult.error.message, "student numbers");
  }

  const maxSuffix = Math.max(
    highestSuffixFromNumber(studentsResult.data?.student_number, yearPrefix),
    highestSuffixFromNumber(peopleResult.data?.person_number, yearPrefix)
  );

  if (maxSuffix === 0) {
    return [];
  }

  return [`${yearPrefix}-${String(maxSuffix).padStart(4, "0")}`];
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
