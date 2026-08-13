"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const REALTIME_DEBOUNCE_MS = 1500;
export const FALLBACK_POLL_MS = 30_000;

type RealtimeReady = boolean | null;

function useDebouncedCallback(callback: () => void, delayMs: number) {
  const callbackRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return useCallback(() => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      callbackRef.current();
    }, delayMs);
  }, [delayMs]);
}

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

export function useAttendanceRealtime(onChange: () => void, sessionId?: string) {
  const [realtimeReady, setRealtimeReady] = useState<RealtimeReady>(null);
  const scheduleRefresh = useDebouncedCallback(onChange, REALTIME_DEBOUNCE_MS);

  useEffect(() => {
    const supabase = createClient();
    setRealtimeReady(null);

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
          scheduleRefresh();
        }
      )
      .subscribe((status) => {
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
  }, [scheduleRefresh, sessionId]);

  return { realtimeReady };
}

export function usePollingFallback(
  onChange: () => void,
  enabled: boolean,
  intervalMs = FALLBACK_POLL_MS
) {
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      onChangeRef.current();
    };

    // First tick after one interval — avoid double-fetching the initial SSR load.
    const timer = setInterval(tick, intervalMs);

    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, intervalMs]);
}
