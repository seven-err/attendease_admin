import { DEPARTMENTS, STAFF_ORG_UNITS } from "@/lib/constants";

export const STAFF_STATUSES = ["Active", "Inactive", "Archived"] as const;
export type StaffStatus = (typeof STAFF_STATUSES)[number];

export type StaffImportRow = {
  rowNumber: number;
  full_name: string;
  department: string;
  job_title: string;
  person_status: StaffStatus;
};

export type StaffImportPreview = {
  rows: StaffImportRow[];
  errors: { row: number; message: string }[];
};

export type StaffImportResult =
  | {
      success: true;
      imported: number;
      skipped: number;
      errors: { row: number; message: string }[];
    }
  | { success: false; error: string };

const STAFF_DEPARTMENTS = [...DEPARTMENTS, ...STAFF_ORG_UNITS] as const;

const HEADER_ALIASES: Record<
  keyof Omit<StaffImportRow, "rowNumber">,
  string[]
> = {
  full_name: ["full_name", "full name", "name"],
  department: ["department", "dept"],
  job_title: ["job_title", "job title", "position", "role"],
  person_status: ["person_status", "status"],
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

function isStaffStatus(value: string): value is StaffStatus {
  return (STAFF_STATUSES as readonly string[]).includes(value);
}

function mapHeaders(
  headers: string[]
): Partial<Record<keyof Omit<StaffImportRow, "rowNumber">, number>> {
  const mapping: Partial<
    Record<keyof Omit<StaffImportRow, "rowNumber">, number>
  > = {};

  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [
      keyof Omit<StaffImportRow, "rowNumber">,
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
  mapping: Partial<Record<keyof Omit<StaffImportRow, "rowNumber">, number>>,
  field: keyof Omit<StaffImportRow, "rowNumber">
): string {
  const index = mapping[field];
  if (index === undefined) return "";
  return cells[index]?.trim() ?? "";
}

export function parseStaffImportCsv(text: string): StaffImportPreview {
  const rows = parseCsv(text);
  const errors: { row: number; message: string }[] = [];

  if (rows.length === 0) {
    return { rows: [], errors: [{ row: 0, message: "CSV file is empty." }] };
  }

  const [headerRow, ...dataRows] = rows;
  const mapping = mapHeaders(headerRow);
  const requiredFields: (keyof Omit<
    StaffImportRow,
    "rowNumber" | "person_status"
  >)[] = ["full_name", "department", "job_title"];

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

  const parsedRows: StaffImportRow[] = [];

  dataRows.forEach((cells, index) => {
    const rowNumber = index + 2;
    const statusValue = getCell(cells, mapping, "person_status") || "Active";
    const row: StaffImportRow = {
      rowNumber,
      full_name: getCell(cells, mapping, "full_name"),
      department: getCell(cells, mapping, "department"),
      job_title: getCell(cells, mapping, "job_title"),
      person_status: isStaffStatus(statusValue) ? statusValue : "Active",
    };

    if (!row.full_name && !row.department && !row.job_title) {
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
    if (!(STAFF_DEPARTMENTS as readonly string[]).includes(row.department)) {
      errors.push({ row: rowNumber, message: `Invalid department: ${row.department}.` });
      return;
    }
    if (!row.job_title) {
      errors.push({ row: rowNumber, message: "Job title is required." });
      return;
    }
    if (!isStaffStatus(row.person_status)) {
      errors.push({ row: rowNumber, message: `Invalid status: ${row.person_status}.` });
      return;
    }

    parsedRows.push(row);
  });

  if (parsedRows.length === 0 && errors.length === 0) {
    errors.push({ row: 0, message: "No employee rows found in CSV." });
  }

  return { rows: parsedRows, errors };
}

export function staffImportCsvTemplate(): string {
  return [
    "full_name,department,job_title,person_status",
    "Ana Reyes,CCS,IT Staff,Active",
    "Ben Santos,ADMIN,Registrar Staff,Active",
  ].join("\n");
}
