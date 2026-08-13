"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDashboardRealtime } from "@/lib/hooks/useDashboardRealtime";
import {
  FALLBACK_POLL_MS,
  usePollingFallback,
} from "@/lib/hooks/useAttendanceRealtime";

export function DashboardRealtime({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const { realtimeReady } = useDashboardRealtime(refresh);
  usePollingFallback(refresh, realtimeReady === false, FALLBACK_POLL_MS);

  return <>{children}</>;
}
