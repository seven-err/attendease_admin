import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { getRecentSessionSummaries } from "@/lib/data/dashboard";
import {
  displaySessionStatus,
  formatDate,
  formatTimeRange,
  sessionStatusVariant,
} from "@/lib/format";
import { Calendar, Clock } from "lucide-react";

export async function RecentSessionsPanel() {
  const sessions = await getRecentSessionSummaries(5);

  return (
    <Card className="lg:col-span-7">
      <CardHeader
        action={
          <Link href="/sessions" className="link-brand text-sm">
            View all
          </Link>
        }
      >
        <h3 className="text-base font-bold">Recent Sessions</h3>
      </CardHeader>
      <CardBody className="space-y-3">
        {sessions.length === 0 ? (
          <p className="empty-state">No sessions yet.</p>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-border-subtle p-3 transition-colors hover:bg-surface-raised"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold">{session.title}</p>
                  {session.department && (
                    <Badge dept={session.department}>{session.department}</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="size-3.5 shrink-0" aria-hidden />
                    {formatDate(session.date)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-3.5 shrink-0" aria-hidden />
                    {formatTimeRange(session.start_time, session.end_time)}
                  </span>
                </div>
                <p className="text-xs text-text-muted">
                  Checker: {session.checker_name ?? "Unassigned"}
                </p>
              </div>
              <Badge variant={sessionStatusVariant(session.status)}>
                {displaySessionStatus(session.status)}
              </Badge>
            </div>
          ))
        )}
      </CardBody>
    </Card>
  );
}
