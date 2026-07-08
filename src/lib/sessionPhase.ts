import { AttendanceSession } from "@/lib/attendeaseTypes";

export type ResolvedPhaseTimes = {
  timeInStart: string;
  timeInEnd: string;
  timeOutStart: string;
  timeOutEnd: string;
};

function parseStoredTimeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function minutesToStoredTime(total: number): string {
  const clamped = Math.min(Math.max(total, 0), 23 * 60 + 59);
  const hour = Math.floor(clamped / 60);
  const minute = clamped % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function addMinutesToStoredTime(value: string, minutes: number): string {
  const base = parseStoredTimeToMinutes(value);
  if (base === null) return value;
  return minutesToStoredTime(base + minutes);
}

export function resolvePhaseTimes(session: Pick<AttendanceSession, "start_time" | "end_time" | "time_in_start" | "time_in_end" | "time_out_start" | "time_out_end">): ResolvedPhaseTimes {
  const start = session.start_time;
  const end = session.end_time;

  return {
    timeInStart: session.time_in_start ?? start,
    timeInEnd: session.time_in_end ?? addMinutesToStoredTime(start, 30),
    timeOutStart: session.time_out_start ?? addMinutesToStoredTime(end, -30),
    timeOutEnd: session.time_out_end ?? end,
  };
}

export const DEFAULT_PHASE_TIMES: ResolvedPhaseTimes = {
  timeInStart: "08:00",
  timeInEnd: "08:30",
  timeOutStart: "09:30",
  timeOutEnd: "10:00",
};
