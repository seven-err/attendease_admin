import { Badge } from "@/components/ui/Badge";
import { SessionAttendanceRow } from "@/lib/attendeaseTypes";
import {
  formatDateTimeOrDash,
  resolvedAttendanceStatusVariant,
} from "@/lib/format";

type AttendanceRosterTableProps = {
  rows: SessionAttendanceRow[];
  emptyMessage?: string;
};

export function AttendanceRosterTable({
  rows,
  emptyMessage = "No students found for this session.",
}: AttendanceRosterTableProps) {
  return (
    <div className="max-h-[60vh] overflow-auto rounded border border-border">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="sticky top-0 border-b border-border bg-header-bg">
          <tr className="text-left text-[11px] font-bold uppercase text-text-secondary">
            <th className="px-4 py-3">Student #</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Year</th>
            <th className="px-4 py-3">Time In</th>
            <th className="px-4 py-3">Time Out</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-8 text-center text-text-secondary"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="border-b border-border">
                <td className="px-4 py-3 font-mono">{row.student_number}</td>
                <td className="px-4 py-3 font-bold">{row.student_name}</td>
                <td className="px-4 py-3">{row.year_level ?? "—"}</td>
                <td className="px-4 py-3 text-text-secondary">
                  {formatDateTimeOrDash(row.time_in)}
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  {formatDateTimeOrDash(row.time_out)}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={resolvedAttendanceStatusVariant(
                      row.attendance_status
                    )}
                  >
                    {row.attendance_status.toUpperCase()}
                  </Badge>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
