import { Suspense } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DashboardRealtime } from "./DashboardRealtime";
import { DashboardStatsCards } from "./DashboardStatsCards";
import { RecentActivityPanel } from "./RecentActivityPanel";
import { RecentSessionsPanel } from "./RecentSessionsPanel";
import {
  CardSkeleton,
  PanelSkeleton,
} from "@/components/ui/PageSkeletons";

export default function DashboardPage() {
  return (
    <DashboardRealtime>
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="Dashboard"
          description="Attendance overview for today"
        />

        <Suspense
          fallback={
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <CardSkeleton key={idx} />
              ))}
            </div>
          }
        >
          <DashboardStatsCards />
        </Suspense>

        <div className="grid gap-4 lg:grid-cols-12">
          <Suspense fallback={<PanelSkeleton className="lg:col-span-7" />}>
            <RecentSessionsPanel />
          </Suspense>
          <Suspense fallback={<PanelSkeleton className="lg:col-span-5" />}>
            <RecentActivityPanel />
          </Suspense>
        </div>
      </div>
    </DashboardRealtime>
  );
}
