/**
 * Learning days roll over at 04:00 local time (the computer running the app):
 * studying at 01:30 still counts for the previous day.
 */
export const ROLLOVER_HOUR = 4;

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" of the learning day that `date` belongs to. */
export function dayKey(date: Date = new Date(), rolloverHour = ROLLOVER_HOUR): string {
  const d = new Date(date.getTime());
  d.setHours(d.getHours() - rolloverHour);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local Date at which the learning day `key` starts (04:00). */
export function dayStart(key: string, rolloverHour = ROLLOVER_HOUR): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, rolloverHour, 0, 0, 0);
}

/** Start of the day after `key`. */
export function nextDayStart(key: string, rolloverHour = ROLLOVER_HOUR): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d + 1, rolloverHour, 0, 0, 0);
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(y, m - 1, d + n, 12);
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

export interface Streak {
  /** consecutive completed days up to today (or up to yesterday if today isn't finished yet) */
  current: number;
  best: number;
  completedToday: boolean;
}

/** Streak from the set of completed learning days. */
export function computeStreak(completed: Iterable<string>, today: string): Streak {
  const set = new Set(completed);
  const completedToday = set.has(today);
  let current = 0;
  let cursor = completedToday ? today : addDays(today, -1);
  while (set.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  let best = 0;
  const sorted = [...set].sort();
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best: Math.max(best, current), completedToday };
}
