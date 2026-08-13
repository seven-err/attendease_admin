import {
  ADMIN_ROLE,
  DEPARTMENT_ADMIN_ROLE,
  type AppRole,
  type PortalRole,
} from "@/lib/constants";
import type { AppUserProfile } from "@/lib/attendeaseTypes";

/** Fine-grained permission keys (DB catalog + UI). */
export const PERMISSION_KEYS = [
  "people.view",
  "people.create",
  "people.edit",
  "people.archive",
  "people.delete",
  "qr.view",
  "qr.generate",
  "qr.regenerate",
  "qr.export",
  "sessions.view",
  "sessions.create",
  "sessions.edit",
  "sessions.archive",
  "sessions.delete",
  "attendance.view",
  "attendance.edit",
  "attendance.void",
  "attendance.export",
  "checkers.view",
  "checkers.manage",
  "checkers.pin_manage",
  "reports.view",
  "reports.export",
  "bulk_import.view",
  "bulk_import.execute",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export type PermissionGroupKey =
  | "people"
  | "qr"
  | "sessions"
  | "attendance"
  | "checkers"
  | "reports"
  | "bulk_import";

export type PermissionDefinition = {
  key: PermissionKey;
  group: PermissionGroupKey;
  label: string;
  description: string;
  highRisk: boolean;
};

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    key: "people.view",
    group: "people",
    label: "View people",
    description: "Browse students and staff in scope",
    highRisk: false,
  },
  {
    key: "people.create",
    group: "people",
    label: "Create people",
    description: "Add students or staff records",
    highRisk: false,
  },
  {
    key: "people.edit",
    group: "people",
    label: "Edit people",
    description: "Update roster and academic records",
    highRisk: false,
  },
  {
    key: "people.archive",
    group: "people",
    label: "Archive people",
    description: "Archive or restore people",
    highRisk: true,
  },
  {
    key: "people.delete",
    group: "people",
    label: "Delete people",
    description: "Permanently delete people",
    highRisk: true,
  },
  {
    key: "qr.view",
    group: "qr",
    label: "View QR",
    description: "View QR credentials",
    highRisk: false,
  },
  {
    key: "qr.generate",
    group: "qr",
    label: "Generate QR",
    description: "Generate missing QR tokens",
    highRisk: false,
  },
  {
    key: "qr.regenerate",
    group: "qr",
    label: "Regenerate QR",
    description: "Replace existing QR tokens",
    highRisk: true,
  },
  {
    key: "qr.export",
    group: "qr",
    label: "Export QR",
    description: "Export or print QR sheets",
    highRisk: false,
  },
  {
    key: "sessions.view",
    group: "sessions",
    label: "View sessions",
    description: "Browse sessions in scope",
    highRisk: false,
  },
  {
    key: "sessions.create",
    group: "sessions",
    label: "Create sessions",
    description: "Create main and sub-sessions",
    highRisk: false,
  },
  {
    key: "sessions.edit",
    group: "sessions",
    label: "Edit sessions",
    description: "Update and open/close sessions",
    highRisk: false,
  },
  {
    key: "sessions.archive",
    group: "sessions",
    label: "Archive sessions",
    description: "Archive or restore sessions",
    highRisk: true,
  },
  {
    key: "sessions.delete",
    group: "sessions",
    label: "Delete sessions",
    description: "Permanently delete sessions",
    highRisk: true,
  },
  {
    key: "attendance.view",
    group: "attendance",
    label: "View attendance",
    description: "Browse attendance logs",
    highRisk: false,
  },
  {
    key: "attendance.edit",
    group: "attendance",
    label: "Edit attendance",
    description: "Correct attendance records",
    highRisk: true,
  },
  {
    key: "attendance.void",
    group: "attendance",
    label: "Void attendance",
    description: "Void attendance records",
    highRisk: true,
  },
  {
    key: "attendance.export",
    group: "attendance",
    label: "Export attendance",
    description: "Export attendance data",
    highRisk: false,
  },
  {
    key: "checkers.view",
    group: "checkers",
    label: "View checkers",
    description: "Browse checker accounts",
    highRisk: false,
  },
  {
    key: "checkers.manage",
    group: "checkers",
    label: "Manage checkers",
    description: "Create and edit checker accounts",
    highRisk: true,
  },
  {
    key: "checkers.pin_manage",
    group: "checkers",
    label: "Manage checker PINs",
    description: "Reset or manage checker PINs",
    highRisk: true,
  },
  {
    key: "reports.view",
    group: "reports",
    label: "View reports",
    description: "Browse report screens",
    highRisk: false,
  },
  {
    key: "reports.export",
    group: "reports",
    label: "Export reports",
    description: "Download report exports",
    highRisk: false,
  },
  {
    key: "bulk_import.view",
    group: "bulk_import",
    label: "View bulk import",
    description: "Open bulk import tools",
    highRisk: false,
  },
  {
    key: "bulk_import.execute",
    group: "bulk_import",
    label: "Execute bulk import",
    description: "Confirm and run imports",
    highRisk: true,
  },
];

export const PERMISSION_GROUPS: {
  key: PermissionGroupKey;
  label: string;
}[] = [
  { key: "people", label: "People" },
  { key: "qr", label: "QR" },
  { key: "sessions", label: "Sessions" },
  { key: "attendance", label: "Attendance" },
  { key: "checkers", label: "Checkers" },
  { key: "reports", label: "Reports" },
  { key: "bulk_import", label: "Bulk Import" },
];

export const HIGH_RISK_PERMISSIONS: PermissionKey[] = PERMISSION_DEFINITIONS.filter(
  (p) => p.highRisk
).map((p) => p.key);

/**
 * Starter grants for new department admins.
 * Matches the portal areas they operate: People, Checkers, Sessions,
 * bulk import, and bulk attendance export (from Sessions).
 * Overview and Audit Log are available to all portal users (no permission key).
 */
export const DEFAULT_DEPARTMENT_ADMIN_PERMISSIONS: PermissionKey[] = [
  "people.view",
  "people.create",
  "people.edit",
  "checkers.view",
  "checkers.manage",
  "checkers.pin_manage",
  "sessions.view",
  "sessions.create",
  "sessions.edit",
  "attendance.view",
  "attendance.export",
  "bulk_import.view",
  "bulk_import.execute",
];

export type AuthzProfile = Pick<AppUserProfile, "role"> & {
  permissions?: readonly PermissionKey[] | null;
};

export function isPortalRole(role: string): role is PortalRole {
  return role === ADMIN_ROLE || role === DEPARTMENT_ADMIN_ROLE;
}

export function isSuperAdmin(
  profile: Pick<AppUserProfile, "role"> | null | undefined
): boolean {
  return profile?.role === ADMIN_ROLE;
}

export function isDepartmentAdmin(
  profile: Pick<AppUserProfile, "role"> | null | undefined
): boolean {
  return profile?.role === DEPARTMENT_ADMIN_ROLE;
}

export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(value);
}

export function normalizePermissionKeys(
  keys: readonly string[] | null | undefined
): PermissionKey[] {
  if (!keys?.length) return [];
  const unique = new Set<PermissionKey>();
  for (const key of keys) {
    if (isPermissionKey(key)) unique.add(key);
  }
  return PERMISSION_KEYS.filter((key) => unique.has(key));
}

/**
 * Central authorization check.
 * Super admins always pass. Department admins need an explicit grant.
 */
export function can(
  profile: AuthzProfile | null | undefined,
  permission: PermissionKey
): boolean {
  if (!profile || !isPortalRole(profile.role)) return false;
  if (profile.role === ADMIN_ROLE) return true;
  return Boolean(profile.permissions?.includes(permission));
}

export function canAny(
  profile: AuthzProfile | null | undefined,
  permissions: readonly PermissionKey[]
): boolean {
  return permissions.some((permission) => can(profile, permission));
}

export function canAll(
  profile: AuthzProfile | null | undefined,
  permissions: readonly PermissionKey[]
): boolean {
  return permissions.every((permission) => can(profile, permission));
}

export function permissionsFor(role: AppRole): PermissionKey[] {
  if (role === ADMIN_ROLE) return [...PERMISSION_KEYS];
  if (role === DEPARTMENT_ADMIN_ROLE) return [];
  return [];
}

/** Effective department scope for queries. Null = campus-wide (super admin). */
export function scopedDepartment(
  profile: Pick<AppUserProfile, "role" | "department"> | null | undefined
): string | null {
  if (!profile) return null;
  if (profile.role === DEPARTMENT_ADMIN_ROLE) {
    return profile.department?.trim() || null;
  }
  return null;
}

export function summarizePermissions(keys: readonly PermissionKey[]): {
  total: number;
  highRisk: number;
  byGroup: Record<PermissionGroupKey, number>;
} {
  const byGroup = Object.fromEntries(
    PERMISSION_GROUPS.map((g) => [g.key, 0])
  ) as Record<PermissionGroupKey, number>;

  let highRisk = 0;
  for (const key of keys) {
    const def = PERMISSION_DEFINITIONS.find((p) => p.key === key);
    if (!def) continue;
    byGroup[def.group] += 1;
    if (def.highRisk) highRisk += 1;
  }

  return { total: keys.length, highRisk, byGroup };
}

/** @deprecated Prefer PermissionKey + can(). Kept for gradual migration. */
export type AdminCapability =
  | "manage_departments"
  | "manage_users"
  | "manage_department_admins"
  | "manage_system_settings"
  | "view_campus_reports"
  | "view_audit_log"
  | "bulk_import"
  | "manage_people"
  | "manage_qr"
  | "manage_checkers"
  | "manage_sessions"
  | "manage_attendance"
  | "view_reports"
  | "view_profile";

const CAPABILITY_TO_PERMISSIONS: Record<AdminCapability, PermissionKey[]> = {
  manage_departments: [],
  manage_users: [],
  manage_department_admins: [],
  manage_system_settings: [],
  view_campus_reports: ["reports.view"],
  view_audit_log: [],
  bulk_import: ["bulk_import.view", "bulk_import.execute"],
  manage_people: ["people.view", "people.create", "people.edit"],
  manage_qr: ["qr.view", "qr.generate"],
  manage_checkers: ["checkers.view", "checkers.manage"],
  manage_sessions: ["sessions.view", "sessions.create", "sessions.edit"],
  manage_attendance: ["attendance.view", "attendance.edit"],
  view_reports: ["reports.view"],
  view_profile: [],
};

/** Capabilities every portal user (incl. department admin) may use. */
const PORTAL_OPEN_CAPABILITIES: AdminCapability[] = [
  "view_audit_log",
  "view_profile",
];

const SUPER_ADMIN_ONLY_CAPABILITIES: AdminCapability[] = [
  "manage_departments",
  "manage_users",
  "manage_department_admins",
  "manage_system_settings",
  "view_campus_reports",
];

/**
 * Legacy capability bridge used while call sites migrate to PermissionKey.
 * Super-admin-only capabilities still require admin role.
 */
export function canCapability(
  profile: AuthzProfile | null | undefined,
  capability: AdminCapability
): boolean {
  if (!profile || !isPortalRole(profile.role)) return false;
  if (profile.role === ADMIN_ROLE) return true;
  if (SUPER_ADMIN_ONLY_CAPABILITIES.includes(capability)) return false;
  if (PORTAL_OPEN_CAPABILITIES.includes(capability)) return true;
  const required = CAPABILITY_TO_PERMISSIONS[capability];
  if (!required.length) return false;
  return canAny(profile, required);
}
