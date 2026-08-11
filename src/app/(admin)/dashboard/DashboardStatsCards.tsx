import { getAdminOverviewStats } from "@/lib/admin/overview";
import {
  Barcode,
  Building2,
  DoorOpen,
  UserCheck,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/Card";

export async function DashboardStatsCards() {
  const stats = await getAdminOverviewStats();
  const isScoped = Boolean(stats.scopedDepartment);

  const cards = [
    {
      label: isScoped ? "Department Members" : "Active People",
      value: stats.totalStudents,
      icon: Users,
      format: true,
    },
    {
      label: "Active Checkers",
      value: stats.activeCheckers,
      icon: UserCheck,
    },
    {
      label: "Open Sessions Today",
      value: stats.openSessionsToday,
      icon: DoorOpen,
    },
    {
      label: "Attendance Today",
      value: stats.scansToday,
      icon: Barcode,
    },
    ...(!isScoped
      ? [
          {
            label: "Active Departments",
            value: stats.activeDepartments,
            icon: Building2,
          },
        ]
      : []),
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
      {cards.map(({ label, value, icon: Icon, format }) => (
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
            {format ? value.toLocaleString() : value}
          </p>
        </Card>
      ))}
    </div>
  );
}
