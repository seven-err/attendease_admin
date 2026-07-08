"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDashboardRealtime } from "@/lib/hooks/useDashboardRealtime";
import { usePollingFallback } from "@/lib/hooks/useAttendanceRealtime";

export function DashboardRealtime({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  useDashboardRealtime(refresh);
  usePollingFallback(refresh, true, 5000);

  return <>{children}</>;
}
