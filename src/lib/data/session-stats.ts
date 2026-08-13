export type SessionLogCounts = {
  present: number;
  late: number;
  lateExcused: number;
  absent: number;
};

export type SessionLogCountsMap = Map<string, SessionLogCounts>;

export function emptyLogCounts(): SessionLogCounts {
  return { present: 0, late: 0, lateExcused: 0, absent: 0 };
}
