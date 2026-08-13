"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const DASHBOARD_TABLES = [
  "attendance_logs",
  "students",
  "attendance_sessions",
  "users",
] as const;

const REALTIME_DEBOUNCE_MS = 1500;

type RealtimeReady = boolean | null;

function isRealtimeConnected(status: string) {
  return status === "SUBSCRIBED";
}

function isRealtimeDisconnected(status: string) {
  return (
    status === "CHANNEL_ERROR" ||
    status === "TIMED_OUT" ||
    status === "CLOSED"
  );
}

export function useDashboardRealtime(onChange: () => void) {
  const [realtimeReady, setRealtimeReady] = useState<RealtimeReady>(null);
  const onChangeRef = useRef(onChange);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const scheduleRefresh = useCallback(() => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      onChangeRef.current();
    }, REALTIME_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();
    setRealtimeReady(null);

    const channel = supabase.channel("dashboard");

    for (const table of DASHBOARD_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          scheduleRefresh();
        }
      );
    }

    channel.subscribe((status) => {
      if (isRealtimeConnected(status)) {
        setRealtimeReady(true);
        return;
      }
      if (isRealtimeDisconnected(status)) {
        setRealtimeReady(false);
      }
    });

    return () => {
      setRealtimeReady(null);
      void supabase.removeChannel(channel);
    };
  }, [scheduleRefresh]);

  return { realtimeReady };
}
