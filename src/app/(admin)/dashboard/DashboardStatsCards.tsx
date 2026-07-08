import { getDashboardStats } from "@/lib/data/dashboard";
import {
  Barcode,
  DoorOpen,
  UserCheck,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/Card";

const statCardConfig = [
  { label: "Active Checkers", key: "activeCheckers" as const, icon: UserCheck },
  { label: "Total Students", key: "totalStudents" as const, icon: Users },
  { label: "Open Sessions Today", key: "openSessionsToday" as const, icon: DoorOpen },
  { label: "Attendance Scans Today", key: "scansToday" as const, icon: Barcode },
];

export async function DashboardStatsCards() {
  const stats = await getDashboardStats();

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {statCardConfig.map(({ label, key, icon: Icon }) => (
        <Card
          key={label}
          className="flex h-32 flex-col justify-between p-4 transition-shadow hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-text-secondary">{label}</p>
            <div className="stat-icon-wrap">
              <Icon className="size-4" aria-hidden />
            </div>
          </div>
          <p className="text-3xl font-bold tracking-tight text-foreground">
            {key === "totalStudents"
              ? stats[key].toLocaleString()
              : stats[key]}
          </p>
        </Card>
      ))}
    </div>
  );
}
