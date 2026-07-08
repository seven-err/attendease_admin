import {
  STUDENT_STATUSES,
  StudentFormInput,
  StudentStatus,
} from "@/lib/attendeaseTypes";
import { DEPARTMENTS, YEAR_LEVELS } from "@/lib/constants";
import { currentAcademicYear } from "@/lib/validations/student";

export type StudentImportRow = StudentFormInput & {
  rowNumber: number;
};

export type StudentImportPreview = {
  rows: StudentImportRow[];
  errors: { row: number; message: string }[];
};

export type StudentImportResult =
  | {
      success: true;
      imported: number;
      skipped: number;
      errors: { row: number; message: string }[];
    }
  | { success: false; error: string };

const HEADER_ALIASES: Record<keyof Omit<StudentFormInput, "academic_year">, string[]> = {
  student_number: ["student_number", "student number", "student #", "student#", "id"],
  full_name: ["full_name", "full name", "name"],
  student_status: ["student_status", "status"],
  department: ["department", "dept"],
  course: ["course"],
  year_level: ["year_level", "year level", "year"],
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsv(text: string): string[][] {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(parseCsvLine);
}

function isStudentStatus(value: string): value is StudentStatus {
  return (STUDENT_STATUSES as readonly string[]).includes(value);
}

function mapHeaders(headers: string[]): Partial<Record<keyof StudentFormInput, number>> {
  const mapping: Partial<Record<keyof StudentFormInput, number>> = {};

  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [
      keyof Omit<StudentFormInput, "academic_year">,
      string[],
    ][]) {
      if (aliases.some((alias) => normalizeHeader(alias) === normalized)) {
        mapping[field] = index;
      }
    }
  });

  return mapping;
}

function getCell(
  cells: string[],
  mapping: Partial<Record<keyof StudentFormInput, number>>,
  field: keyof Omit<StudentFormInput, "academic_year">
): string {
  const index = mapping[field];
  if (index === undefined) return "";
  return cells[index]?.trim() ?? "";
}

export function parseStudentImportCsv(text: string): StudentImportPreview {
  const rows = parseCsv(text);
  const errors: { row: number; message: string }[] = [];

  if (rows.length === 0) {
    return { rows: [], errors: [{ row: 0, message: "CSV file is empty." }] };
  }

  const [headerRow, ...dataRows] = rows;
  const mapping = mapHeaders(headerRow);

  const requiredFields: (keyof Omit<StudentFormInput, "academic_year" | "student_status">)[] = [
    "student_number",
    "full_name",
    "department",
    "course",
    "year_level",
  ];

  for (const field of requiredFields) {
    if (mapping[field] === undefined) {
      errors.push({
        row: 1,
        message: `Missing required column: ${field.replace("_", " ")}.`,
      });
    }
  }

  if (errors.length > 0) {
    return { rows: [], errors };
  }

  const parsedRows: StudentImportRow[] = [];

  dataRows.forEach((cells, index) => {
    const rowNumber = index + 2;
    const statusValue = getCell(cells, mapping, "student_status") || "Active";
    const row: StudentImportRow = {
      rowNumber,
      student_number: getCell(cells, mapping, "student_number"),
      full_name: getCell(cells, mapping, "full_name"),
      student_status: isStudentStatus(statusValue) ? statusValue : "Active",
      department: getCell(cells, mapping, "department"),
      course: getCell(cells, mapping, "course"),
      year_level: getCell(cells, mapping, "year_level"),
      academic_year: currentAcademicYear(),
    };

    if (
      !row.student_number &&
      !row.full_name &&
      !row.department &&
      !row.course &&
      !row.year_level
    ) {
      return;
    }

    if (!row.student_number) {
      errors.push({ row: rowNumber, message: "Student number is required." });
      return;
    }
    if (!row.full_name) {
      errors.push({ row: rowNumber, message: "Full name is required." });
      return;
    }
    if (!row.department) {
      errors.push({ row: rowNumber, message: "Department is required." });
      return;
    }
    if (!(DEPARTMENTS as readonly string[]).includes(row.department)) {
      errors.push({ row: rowNumber, message: `Invalid department: ${row.department}.` });
      return;
    }
    if (!row.course) {
      errors.push({ row: rowNumber, message: "Course is required." });
      return;
    }
    if (!row.year_level) {
      errors.push({ row: rowNumber, message: "Year level is required." });
      return;
    }
    if (!(YEAR_LEVELS as readonly string[]).includes(row.year_level)) {
      errors.push({ row: rowNumber, message: `Invalid year level: ${row.year_level}.` });
      return;
    }
    if (!isStudentStatus(row.student_status)) {
      errors.push({ row: rowNumber, message: `Invalid status: ${row.student_status}.` });
      return;
    }

    parsedRows.push(row);
  });

  if (parsedRows.length === 0 && errors.length === 0) {
    errors.push({ row: 0, message: "No student rows found in CSV." });
  }

  return { rows: parsedRows, errors };
}

export function studentImportCsvTemplate(): string {
  return [
    "student_number,full_name,department,course,year_level,student_status",
    "2026-0001,Juan Dela Cruz,CCS,BSIT,1st Year,Active",
    "2026-0002,Maria Santos,CCJE,BS Criminology,2nd Year,Active",
  ].join("\n");
}
