import { PenaltySessionContext } from "@/lib/attendeaseTypes";
import { hasSessionEnded } from "@/lib/sessionPhase";

export const PENALTY_PHP_MAX = 999_999.99;

export type PenaltyReason =
  | "none"
  | "late"
  | "no_time_in"
  | "no_time_out"
  | "absent"
  | "pending";

export type PenaltyAssessment = {
  reason: PenaltyReason;
  amountPhp: number;
  label: string;
};

export function coercePenaltyPhp(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return roundPhp(Math.min(n, PENALTY_PHP_MAX));
}

export function roundPhp(value: number): number {
  return Math.round(value * 100) / 100;
}

export function incompletePenaltyPhp(absentPhp: number): number {
  return roundPhp(coercePenaltyPhp(absentPhp) / 2);
}

/** Stored override when present; otherwise half of Absent. */
export function resolveIncompletePenaltyPhp(
  absentPhp: unknown,
  incompletePhp: unknown
): number {
  if (incompletePhp === undefined || incompletePhp === null) {
    return incompletePenaltyPhp(coercePenaltyPhp(absentPhp));
  }
  return coercePenaltyPhp(incompletePhp);
}

export function formatPeso(amount: number): string {
  const n = coercePenaltyPhp(amount);
  return `₱${n.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPenaltyRatesSummary(params: {
  latePhp?: number | null;
  absentPhp?: number | null;
  incompletePhp?: number | null;
}): string {
  const late = coercePenaltyPhp(params.latePhp);
  const absent = coercePenaltyPhp(params.absentPhp);
  const incomplete = resolveIncompletePenaltyPhp(absent, params.incompletePhp);
  return `Late ${formatPeso(late)} · Absent ${formatPeso(absent)} · No In/Out ${formatPeso(incomplete)}`;
}

export function penaltyInputFromAmount(amount: unknown): string {
  const n = coercePenaltyPhp(amount);
  if (n === 0) return "";
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export type PenaltyFormState = {
  late: string;
  absent: string;
  incomplete: string;
  /** When true, editing Absent auto-fills No Time In/Out to half of Absent. */
  incompleteFollowsAbsent: boolean;
};

export function penaltyFormFromRates(
  late: unknown,
  absent: unknown,
  incomplete?: unknown
): PenaltyFormState {
  const absentN = coercePenaltyPhp(absent);
  const incompleteN = resolveIncompletePenaltyPhp(absentN, incomplete);
  const follows = incompleteN === incompletePenaltyPhp(absentN);
  return {
    late: penaltyInputFromAmount(late),
    absent: penaltyInputFromAmount(absent),
    incomplete:
      !follows && incompleteN === 0
        ? "0"
        : penaltyInputFromAmount(incompleteN),
    incompleteFollowsAbsent: follows,
  };
}

export function applyAbsentChange(
  form: PenaltyFormState,
  nextAbsent: string
): PenaltyFormState {
  if (!form.incompleteFollowsAbsent) {
    return { ...form, absent: nextAbsent };
  }
  const nextParsed = parsePenaltyPhpInput(nextAbsent);
  if (!nextParsed.ok) {
    return { ...form, absent: nextAbsent, incompleteFollowsAbsent: true };
  }
  return {
    ...form,
    absent: nextAbsent,
    incomplete: penaltyInputFromAmount(incompletePenaltyPhp(nextParsed.value)),
    incompleteFollowsAbsent: true,
  };
}

export function applyIncompleteChange(
  form: PenaltyFormState,
  nextIncomplete: string
): PenaltyFormState {
  const absentParsed = parsePenaltyPhpInput(form.absent);
  const incompleteParsed = parsePenaltyPhpInput(nextIncomplete);
  const half = incompletePenaltyPhp(absentParsed.ok ? absentParsed.value : 0);
  const follows =
    !nextIncomplete.trim() ||
    (incompleteParsed.ok && incompleteParsed.value === half);
  return {
    ...form,
    incomplete: nextIncomplete,
    incompleteFollowsAbsent: follows,
  };
}

export function parsePenaltyPhpInput(
  text: string
): { ok: true; value: number } | { ok: false; error: string } {
  const trimmed = text.trim().replace(/,/g, "");
  if (!trimmed) return { ok: true, value: 0 };
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { ok: false, error: "Use a peso amount such as 15 or 50.00." };
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) {
    return { ok: false, error: "Penalty amounts cannot be negative." };
  }
  if (value > PENALTY_PHP_MAX) {
    return {
      ok: false,
      error: `Penalty amounts cannot exceed ${formatPeso(PENALTY_PHP_MAX)}.`,
    };
  }
  return { ok: true, value: roundPhp(value) };
}

export function parsePenaltyFormFields(params: {
  late: string;
  absent: string;
  incomplete: string;
}):
  | { ok: true; late: number; absent: number; incomplete: number }
  | { ok: false; error: string } {
  const late = parsePenaltyPhpInput(params.late);
  if (!late.ok) return late;
  const absent = parsePenaltyPhpInput(params.absent);
  if (!absent.ok) return absent;
  const incomplete = parsePenaltyPhpInput(params.incomplete);
  if (!incomplete.ok) return incomplete;
  const incompleteValue = !params.incomplete.trim()
    ? incompletePenaltyPhp(absent.value)
    : incomplete.value;
  return {
    ok: true,
    late: late.value,
    absent: absent.value,
    incomplete: incompleteValue,
  };
}

export function resolvePenaltiesInherited(params: {
  mainSessionId?: string | null;
  late: number;
  absent: number;
  incomplete: number;
  mainLate?: number | null;
  mainAbsent?: number | null;
  mainIncomplete?: number | null;
  unknownMainFallback?: boolean;
}): boolean {
  if (!params.mainSessionId) return false;
  if (params.mainLate == null || params.mainAbsent == null) {
    return params.unknownMainFallback ?? true;
  }
  const mainIncomplete = resolveIncompletePenaltyPhp(
    params.mainAbsent,
    params.mainIncomplete
  );
  return (
    coercePenaltyPhp(params.late) === coercePenaltyPhp(params.mainLate) &&
    coercePenaltyPhp(params.absent) === coercePenaltyPhp(params.mainAbsent) &&
    coercePenaltyPhp(params.incomplete) === coercePenaltyPhp(mainIncomplete)
  );
}

export function isStaffPersonKind(kind: string | null | undefined): boolean {
  return kind === "staff";
}

export function penaltyContextFromSession(
  session: PenaltySessionContext
): PenaltySessionContext {
  return {
    status: session.status,
    date: session.date,
    start_time: session.start_time,
    end_time: session.end_time,
    time_in_start: session.time_in_start,
    time_in_end: session.time_in_end,
    time_out_start: session.time_out_start,
    time_out_end: session.time_out_end,
    penalty_late_php: coercePenaltyPhp(session.penalty_late_php),
    penalty_absent_php: coercePenaltyPhp(session.penalty_absent_php),
    penalty_incomplete_php: resolveIncompletePenaltyPhp(
      session.penalty_absent_php,
      session.penalty_incomplete_php
    ),
  };
}

function sessionPenaltiesAreFinal(
  session: PenaltySessionContext,
  now = new Date()
): boolean {
  if (session.status === "Closed" || session.status === "Archived") return true;
  return hasSessionEnded(session, now);
}

/**
 * One mutually exclusive peso outcome per person.
 * Incomplete (missing one punch) uses the stored No In/Out rate (default: half of Absent).
 * Staff are never billed. Matches the checker app.
 */
export function assessAttendancePenalty(params: {
  personKind?: string | null;
  attendanceStatus?: string | null;
  scannedAt?: string | null;
  timeOutAt?: string | null;
  session: PenaltySessionContext;
  now?: Date;
}): PenaltyAssessment {
  if (isStaffPersonKind(params.personKind)) {
    return { reason: "none", amountPhp: 0, label: formatPeso(0) };
  }

  const latePhp = coercePenaltyPhp(params.session.penalty_late_php);
  const absentPhp = coercePenaltyPhp(params.session.penalty_absent_php);
  const incompletePhp = resolveIncompletePenaltyPhp(
    absentPhp,
    params.session.penalty_incomplete_php
  );
  const hasTimeIn = Boolean(params.scannedAt);
  const hasTimeOut = Boolean(params.timeOutAt);
  const ended = sessionPenaltiesAreFinal(params.session, params.now);
  const attendanceStatus = params.attendanceStatus ?? "";

  if (!hasTimeIn && !hasTimeOut) {
    if (!ended) return { reason: "pending", amountPhp: 0, label: "Pending" };
    return {
      reason: "absent",
      amountPhp: absentPhp,
      label: `Absent · ${formatPeso(absentPhp)}`,
    };
  }

  if (!hasTimeIn && hasTimeOut) {
    return {
      reason: "no_time_in",
      amountPhp: incompletePhp,
      label: `No Time In · ${formatPeso(incompletePhp)}`,
    };
  }

  if (hasTimeIn && !hasTimeOut) {
    if (!ended) {
      if (attendanceStatus === "Late") {
        return {
          reason: "late",
          amountPhp: latePhp,
          label: `Late · ${formatPeso(latePhp)}`,
        };
      }
      return { reason: "pending", amountPhp: 0, label: "Pending" };
    }
    return {
      reason: "no_time_out",
      amountPhp: incompletePhp,
      label: `No Time Out · ${formatPeso(incompletePhp)}`,
    };
  }

  if (attendanceStatus === "Late") {
    return {
      reason: "late",
      amountPhp: latePhp,
      label: `Late · ${formatPeso(latePhp)}`,
    };
  }

  return { reason: "none", amountPhp: 0, label: formatPeso(0) };
}

export function assessRecordPenalty(
  record: {
    time_in?: string | null;
    time_out?: string | null;
    attendance_status: string;
    person_kind?: string | null;
    session_penalties?: PenaltySessionContext | null;
  },
  now = new Date()
): PenaltyAssessment {
  if (!record.session_penalties) {
    return { reason: "none", amountPhp: 0, label: formatPeso(0) };
  }

  return assessAttendancePenalty({
    personKind: record.person_kind,
    attendanceStatus: record.attendance_status,
    scannedAt: record.time_in,
    timeOutAt: record.time_out,
    session: record.session_penalties,
    now,
  });
}

export function sumFinalizedPenalties(assessments: PenaltyAssessment[]): number {
  return roundPhp(
    assessments.reduce((total, item) => {
      if (item.reason === "pending") return total;
      return total + item.amountPhp;
    }, 0)
  );
}

/** CSV cell: numeric amount or "Pending". */
export function exportPenaltyCell(assessment: PenaltyAssessment): string {
  if (assessment.reason === "pending") return "Pending";
  return assessment.amountPhp.toFixed(2);
}
