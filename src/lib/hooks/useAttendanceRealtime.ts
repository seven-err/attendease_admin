"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useAttendanceRealtime(onChange: () => void, sessionId?: string) {
  const refresh = useCallback(onChange, [onChange]);

  useEffect(() => {
    const supabase = createClient();

    const filter = sessionId
      ? `session_id=eq.${sessionId}`
      : undefined;

    const channel = supabase
      .channel(`attendance-${sessionId ?? "all"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance_logs",
          ...(filter ? { filter } : {}),
        },
        () => {
          refresh();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh, sessionId]);

  return refresh;
}

export function usePollingFallback(
  onChange: () => void,
  enabled: boolean,
  intervalMs = 5000
) {
  const refresh = useCallback(onChange, [onChange]);

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(refresh, intervalMs);
    return () => clearInterval(timer);
  }, [enabled, intervalMs, refresh]);
}
