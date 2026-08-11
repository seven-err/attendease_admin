/** Wall-clock and display timezone for the attendance system (Philippines). */
export const APP_TIMEZONE = "Asia/Manila" as const;

export const ADMIN_ROLE = "admin" as const;
export const DEPARTMENT_ADMIN_ROLE = "department_admin" as const;
export const CHECKER_ROLE = "attendance_checker" as const;

export type PortalRole = typeof ADMIN_ROLE | typeof DEPARTMENT_ADMIN_ROLE;
export type AppRole = PortalRole | typeof CHECKER_ROLE;

export const PORTAL_ROLES: readonly PortalRole[] = [
  ADMIN_ROLE,
  DEPARTMENT_ADMIN_ROLE,
] as const;

export const DEPARTMENTS = ["CCS", "CCJE", "CBE", "CTE", "PSYCH"] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const SSG_LABEL = "SSG" as const;
export const EMPLOYEE_LABEL = "Employee" as const;
export const CHECKER_DEPARTMENTS = [
  ...DEPARTMENTS,
  SSG_LABEL,
  EMPLOYEE_LABEL,
] as const;
export type CheckerDepartment = (typeof CHECKER_DEPARTMENTS)[number];

/** Staff org units that may exist outside the college department catalog. */
export const STAFF_ORG_UNITS = [
  "ADMIN",
  "OFFICE",
  "ELEMENTARY",
  "HIGH SCHOOL",
] as const;

export const YEAR_LEVELS = [
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
  "5th Year",
] as const;
