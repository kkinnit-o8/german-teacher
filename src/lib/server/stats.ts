/**
 * Numbers for the Progress page.
 */
import "server-only";
import { addDays, computeStreak, type Streak } from "../srs/day";
import { isDue, type StoredCard } from "../srs/scheduler";
import { getDb } from "./db";
import { completedDays, today } from "./session";
import { allWords, getWord, wordBank } from "./words";

export interface ProgressData {
  day: string;
  learned: number;
  bankSize: number;
  byLevel: { level: string; learned: number; total: number }[];
  dueTomorrow: number;
  streak: Streak;
  /** per day of the last weeks: 0 nothing, 1 practised, 2 session complete */
  calendar: { day: string; level: 0 | 1 | 2; learned: number; reviews: number }[];
  /** estimated share of everyday text made of learned words (0..1) */
  coverage: number;
  /** coverage if the whole word bank were learned */
  coverageAll: number;
  milestones: { words: number; coverage: number }[];
}

const WEEKS = 26;

export function progressData(): ProgressData {
  const db = getDb();
  const day = today();
  const learnedIds = (db.prepare("SELECT word_id FROM learned").all() as { word_id: number }[]).map((r) => r.word_id);
  const learnedSet = new Set(learnedIds);
  const bank = wordBank().words;

  const byLevel = (["A1", "A2", "B1"] as const).map((level) => ({
    level,
    learned: bank.filter((w) => w.cefr === level && learnedSet.has(w.id)).length,
    total: bank.filter((w) => w.cefr === level).length,
  }));

  const tomorrow = addDays(day, 1);
  const cards = db.prepare("SELECT card FROM cards").all() as { card: string }[];
  const dueTomorrow = cards.filter((c) => isDue(JSON.parse(c.card) as StoredCard, tomorrow)).length;

  // calendar heatmap
  const completed = new Set(completedDays());
  const learnedPerDay = new Map(
    (db.prepare("SELECT day, COUNT(*) AS n FROM learned GROUP BY day").all() as { day: string; n: number }[]).map((r) => [r.day, r.n]),
  );
  const reviewsPerDay = new Map(
    (db.prepare("SELECT day, COUNT(*) AS n FROM review_log GROUP BY day").all() as { day: string; n: number }[]).map((r) => [
      r.day,
      r.n,
    ]),
  );
  const chatDays = new Set((db.prepare("SELECT DISTINCT day FROM conversations").all() as { day: string }[]).map((r) => r.day));
  // start on a Monday, WEEKS weeks back
  const [y, m, d] = day.split("-").map(Number);
  const weekday = (new Date(y, m - 1, d).getDay() + 6) % 7; // Monday = 0
  const start = addDays(day, -(WEEKS - 1) * 7 - weekday);
  const calendar: ProgressData["calendar"] = [];
  for (let k = addDays(start, 0); k <= day; k = addDays(k, 1)) {
    const learned = learnedPerDay.get(k) ?? 0;
    const reviews = reviewsPerDay.get(k) ?? 0;
    const level: 0 | 1 | 2 = completed.has(k) ? 2 : learned || reviews || chatDays.has(k) ? 1 : 0;
    calendar.push({ day: k, level, learned, reviews });
  }

  const shareOf = (ids: Iterable<number>) => {
    let s = 0;
    for (const id of ids) s += getWord(id)?.share ?? 0;
    return s;
  };
  const coverageAll = bank.reduce((a, w) => a + w.share, 0);
  const milestones = [100, 250, 500, 1000, 1500, 2000]
    .filter((n) => n <= bank.length)
    .map((n) => ({ words: n, coverage: bank.slice(0, n).reduce((a, w) => a + w.share, 0) }));

  return {
    day,
    learned: learnedIds.length,
    bankSize: allWords().length,
    byLevel,
    dueTomorrow,
    streak: computeStreak(completed, day),
    calendar,
    coverage: shareOf(learnedIds),
    coverageAll,
    milestones,
  };
}
