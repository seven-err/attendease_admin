import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { getRecentActivity } from "@/lib/data/dashboard";
import { formatDateTime } from "@/lib/format";

export async function RecentActivityPanel() {
  const recentActivity = await getRecentActivity(5);

  return (
    <Card className="lg:col-span-5">
      <CardHeader>
        <h3 className="text-base font-bold">Recent Activity</h3>
      </CardHeader>
      {recentActivity.length === 0 ? (
        <CardBody>
          <p className="empty-state">No scans recorded yet.</p>
        </CardBody>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-row-hover w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-header-bg text-left text-text-secondary">
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">
                  Student
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">
                  Session
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">
                  Time
                </th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.map((row) => (
                <tr
                  key={`${row.student_name}-${row.scanned_at}`}
                  className="border-b border-border-subtle"
                >
                  <td className="px-4 py-3 font-medium">{row.student_name}</td>
                  <td className="px-4 py-3">{row.session_title}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {formatDateTime(row.scanned_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
