"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { GraduationCap, LogOut, X } from "lucide-react";
import type { AdminShellProfile } from "@/components/layout/AdminShell";
import {
  filterNavItems,
  footerNavItems,
  navItems,
} from "@/lib/navigation";
import { can, isSuperAdmin } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ADMIN_ROLE, DEPARTMENT_ADMIN_ROLE } from "@/lib/constants";

type SidebarProps = {
  profile: AdminShellProfile;
  open?: boolean;
  onClose?: () => void;
};

function roleLabel(role: AdminShellProfile["role"], department: string | null) {
  if (role === ADMIN_ROLE) return "Super Admin";
  if (role === DEPARTMENT_ADMIN_ROLE) {
    return department ? `${department} Admin` : "Department Admin";
  }
  return "Admin";
}

export function Sidebar({ profile, open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const mainNav = useMemo(
    () =>
      filterNavItems(navItems, {
        isSuperAdmin: isSuperAdmin(profile),
        can: (permission) => can(profile, permission),
      }),
    [profile]
  );

  const footerNav = useMemo(
    () =>
      filterNavItems(footerNavItems, {
        isSuperAdmin: isSuperAdmin(profile),
        can: (permission) => can(profile, permission),
      }),
    [profile]
  );

  useEffect(() => {
    onClose?.();
  }, [pathname, onClose]);

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-50 flex h-dvh w-[min(15rem,100vw)] max-w-full flex-col border-r border-border bg-surface shadow-sm transition-transform duration-200 ease-out",
        "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
        open
          ? "translate-x-0"
          : "-translate-x-full max-lg:invisible max-lg:pointer-events-none",
        "lg:visible lg:translate-x-0 lg:pointer-events-auto"
      )}
    >
      <div className="flex items-start justify-between gap-2 border-b border-border-subtle px-5 py-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-maroon shadow-sm">
            <GraduationCap className="size-5 text-white" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold tracking-tight text-maroon">
              AttendEase
            </p>
            <p className="truncate text-xs font-medium text-text-muted">
              {roleLabel(profile.role, profile.department)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="btn-icon shrink-0 lg:hidden"
          aria-label="Close navigation menu"
        >
          <X className="size-5" />
        </button>
      </div>

      <nav
        className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4"
        aria-label="Main"
      >
        {mainNav.map(({ label, href, icon: Icon }) => {
          const active = Boolean(
            pathname &&
              (pathname === href || pathname.startsWith(`${href}/`))
          );
          return (
            <Link
              key={href}
              href={href}
              prefetch={true}
              onClick={onClose}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-maroon-light text-maroon"
                  : "text-text-secondary hover:bg-surface-raised hover:text-foreground"
              )}
            >
              {active && (
                <span
                  className="absolute bottom-1.5 left-0 top-1.5 w-1 rounded-r-full bg-maroon"
                  aria-hidden
                />
              )}
              <Icon className="size-[18px] shrink-0" aria-hidden />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border-subtle px-3 py-4">
        <div className="mb-3 min-w-0 px-3">
          <p className="truncate text-sm font-medium text-foreground">
            {profile.fullName}
          </p>
          <p className="truncate text-xs text-text-muted">{profile.email}</p>
        </div>
        {footerNav.map(({ label, href, icon: Icon }) => {
          const active = Boolean(
            pathname &&
              (pathname === href || pathname.startsWith(`${href}/`))
          );
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-maroon-light text-maroon"
                  : "text-text-secondary hover:bg-surface-raised hover:text-foreground"
              )}
            >
              <Icon className="size-[18px] shrink-0" aria-hidden />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="btn btn-outline-brand mt-3 w-full"
        >
          <LogOut className="size-4 shrink-0" aria-hidden />
          <span className="truncate">
            {loggingOut ? "Logging out..." : "Logout"}
          </span>
        </button>
      </div>
    </aside>
  );
}
