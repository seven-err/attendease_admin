import {
  BarChart3,
  Clock,
  LayoutDashboard,
  Settings,
  UserCheck,
  Users,
} from "lucide-react";

export const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Checkers", href: "/checkers", icon: UserCheck },
  { label: "Students", href: "/students", icon: Users },
  { label: "Sessions", href: "/sessions", icon: Clock },
  { label: "Reports", href: "/reports", icon: BarChart3 },
] as const;

export const footerNavItems = [
  { label: "Settings", href: "/settings", icon: Settings },
] as const;
