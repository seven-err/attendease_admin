/** Wall-clock and display timezone for the attendance system (Philippines). */
export const APP_TIMEZONE = "Asia/Manila" as const;

export const ADMIN_ROLE = "admin" as const;
export const CHECKER_ROLE = "attendance_checker" as const;
export type AppRole = typeof ADMIN_ROLE | typeof CHECKER_ROLE;

export const DEPARTMENTS = ["CCS", "CCJE", "CBE", "CTE", "PSYCH"] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const SSG_LABEL = "SSG" as const;
export const CHECKER_DEPARTMENTS = [
  ...DEPARTMENTS,
  SSG_LABEL,
] as const;
export type CheckerDepartment = (typeof CHECKER_DEPARTMENTS)[number];

export const YEAR_LEVELS = [
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
  "5th Year",
] as const;
