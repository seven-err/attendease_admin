"use client";

import { useCallback, useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import type { PortalRole } from "@/lib/constants";
import type { PermissionKey } from "@/lib/permissions";

export type AdminShellProfile = {
  fullName: string;
  email: string;
  role: PortalRole;
  department: string | null;
  permissions: PermissionKey[];
};

type AdminShellProps = {
  children: React.ReactNode;
  profile: AdminShellProfile;
};

export function AdminShell({ children, profile }: AdminShellProps) {
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = useCallback(() => setNavOpen(false), []);

  useEffect(() => {
    if (!navOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [navOpen]);

  return (
    <div className="flex min-h-dvh min-w-0 overflow-x-hidden bg-background">
      <Sidebar profile={profile} open={navOpen} onClose={closeNav} />

      {navOpen ? (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-[2px] lg:hidden"
          onClick={closeNav}
        />
      ) : null}

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col lg:ml-60">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            className="btn-icon shrink-0"
            aria-label="Open navigation menu"
            aria-expanded={navOpen}
          >
            <Menu className="size-5" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-maroon">AttendEase</p>
            <p className="truncate text-xs text-text-muted">Admin</p>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-5 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
