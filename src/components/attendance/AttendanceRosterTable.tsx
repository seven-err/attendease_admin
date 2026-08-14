import { Badge } from "@/components/ui/Badge";
import { SessionAttendanceRow, PenaltySessionContext } from "@/lib/attendeaseTypes";
import {
  displayAttendanceStatus,
  formatTimeInDisplay,
  formatTimeOutDisplay,
  resolvedAttendanceStatusVariant,
} from "@/lib/format";
import { assessRecordPenalty } from "@/lib/penalties";

type AttendanceRosterTableProps = {
  rows: SessionAttendanceRow[];
  emptyMessage?: string;
  sessionPenalties?: PenaltySessionContext | null;
};

export function AttendanceRosterTable({
  rows,
  emptyMessage = "No students found for this session.",
  sessionPenalties = null,
}: AttendanceRosterTableProps) {
  return (
    <div className="max-h-[60vh] overflow-auto rounded border border-border">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="sticky top-0 border-b border-border bg-header-bg">
          <tr className="text-left text-[11px] font-bold uppercase text-text-secondary">
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Year</th>
            <th className="px-4 py-3">Time In</th>
            <th className="px-4 py-3">Time Out</th>
            <th className="px-4 py-3">Scan By</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Penalty</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-text-secondary"
                  >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const penalty = assessRecordPenalty({
                time_in: row.time_in,
                time_out: row.time_out,
                attendance_status: row.attendance_status,
                person_kind: row.person_kind,
                session_penalties: sessionPenalties ?? undefined,
              });

              return (
              <tr key={row.id} className="border-b border-border">
                <td className="px-4 py-3 font-bold">{row.student_name}</td>
                <td className="px-4 py-3">{row.year_level ?? "—"}</td>
                <td className="px-4 py-3 text-text-secondary">
                  {formatTimeInDisplay(row.time_in, row.time_out)}
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  {formatTimeOutDisplay(row.time_in, row.time_out)}
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  {row.scan_by ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={resolvedAttendanceStatusVariant(
                      row.attendance_status
                    )}
                  >
                    {displayAttendanceStatus(row.attendance_status)}
                  </Badge>
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-text-secondary">
                  {penalty.label}
                </td>
              </tr>
            );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
