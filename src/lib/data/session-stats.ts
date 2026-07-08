export type SessionLogCounts = {
  present: number;
  late: number;
  absent: number;
};

export type SessionLogCountsMap = Map<string, SessionLogCounts>;

export function emptyLogCounts(): SessionLogCounts {
  return { present: 0, late: 0, absent: 0 };
}

export function onTimeCount(counts: SessionLogCounts): number {
  return counts.present + counts.late;
}
