"use client";

import { useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const DASHBOARD_TABLES = [
  "attendance_logs",
  "students",
  "attendance_sessions",
  "users",
] as const;

export function useDashboardRealtime(onChange: () => void) {
  const refresh = useCallback(onChange, [onChange]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase.channel("dashboard");

    for (const table of DASHBOARD_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          refresh();
        }
      );
    }

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh]);
}
