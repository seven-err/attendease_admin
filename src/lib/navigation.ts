import {
  BarChart3,
  Building2,
  Clock,
  FileText,
  LayoutDashboard,
  QrCode,
  Settings,
  Shield,
  Upload,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { PermissionKey } from "@/lib/permissions";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Any of these permissions unlocks the nav item. */
  permissions?: PermissionKey[];
  /** When true, only super admins see this item. */
  superAdminOnly?: boolean;
};

export const navItems: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  {
    label: "Schools & Orgs",
    href: "/departments",
    icon: Building2,
    superAdminOnly: true,
  },
  {
    label: "People",
    href: "/students",
    icon: Users,
    permissions: ["people.view"],
  },
  {
    label: "Users",
    href: "/users",
    icon: Shield,
    superAdminOnly: true,
  },
  {
    label: "Checkers",
    href: "/checkers",
    icon: UserCheck,
    permissions: ["checkers.view"],
  },
  {
    label: "Sessions",
    href: "/sessions",
    icon: Clock,
    permissions: ["sessions.view"],
  },
  {
    label: "Attendance",
    href: "/attendance",
    icon: FileText,
    permissions: ["attendance.view"],
  },
  {
    label: "QR Management",
    href: "/qr",
    icon: QrCode,
    permissions: ["qr.view"],
  },
  {
    label: "Reports",
    href: "/reports",
    icon: BarChart3,
    permissions: ["reports.view"],
  },
  {
    label: "Bulk Import",
    href: "/import",
    icon: Upload,
    permissions: ["bulk_import.view"],
  },
  {
    label: "Audit Log",
    href: "/audit",
    icon: FileText,
  },
];

export const footerNavItems: NavItem[] = [
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    superAdminOnly: true,
  },
  {
    label: "Profile",
    href: "/profile",
    icon: Users,
  },
];

export function filterNavItems(
  items: NavItem[],
  options: {
    isSuperAdmin: boolean;
    can: (permission: PermissionKey) => boolean;
  }
): NavItem[] {
  return items.filter((item) => {
    if (item.superAdminOnly && !options.isSuperAdmin) return false;
    if (item.permissions?.length) {
      return item.permissions.some((permission) => options.can(permission));
    }
    return true;
  });
}
