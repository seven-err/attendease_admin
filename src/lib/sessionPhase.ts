import { APP_TIMEZONE } from "@/lib/constants";
import { AttendanceSession } from "@/lib/attendeaseTypes";
import { todayDateString } from "@/lib/format";

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

function nowMinutesInAppTimezone(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0
  );
  return hour * 60 + minute;
}

/** True once the session date is past, or today at/after time-out end (Asia/Manila). */
export function hasSessionEnded(
  session: Pick<
    AttendanceSession,
    | "date"
    | "start_time"
    | "end_time"
    | "time_in_start"
    | "time_in_end"
    | "time_out_start"
    | "time_out_end"
  >,
  now = new Date()
): boolean {
  const today = todayDateString();
  if (session.date < today) return true;
  if (session.date > today) return false;

  const timeOutEnd = parseStoredTimeToMinutes(
    resolvePhaseTimes(session).timeOutEnd
  );
  if (timeOutEnd === null) return false;
  return nowMinutesInAppTimezone(now) >= timeOutEnd;
}
