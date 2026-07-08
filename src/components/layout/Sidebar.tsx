"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { GraduationCap, LogOut } from "lucide-react";
import { footerNavItems, navItems } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-full w-60 flex-col border-r border-border bg-surface shadow-sm">
      <div className="border-b border-border-subtle px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-maroon shadow-sm">
            <GraduationCap className="size-5 text-white" aria-hidden />
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight text-maroon">
              AttendEase
            </p>
            <p className="text-xs font-medium text-text-muted">Admin Portal</p>
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4" aria-label="Main">
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              prefetch={true}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-maroon-light text-maroon"
                  : "text-text-secondary hover:bg-surface-raised hover:text-foreground"
              )}
            >
              {active && (
                <span
                  className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-maroon"
                  aria-hidden
                />
              )}
              <Icon className="size-[18px] shrink-0" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border-subtle px-3 py-4">
        {footerNavItems.map(({ label, href, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-maroon-light text-maroon"
                  : "text-text-secondary hover:bg-surface-raised hover:text-foreground"
              )}
            >
              <Icon className="size-[18px]" aria-hidden />
              {label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="btn btn-outline-brand mt-3 w-full"
        >
          <LogOut className="size-4" aria-hidden />
          {loggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    </aside>
  );
}
