/**
 * Today's guided session: Review → Learn → Quick check → Conversation → Summary.
 * The state of each learning day is stored as JSON in the `days` table so a
 * session can be resumed.
 */
import "server-only";
import type { Word } from "../words/types";
import { dayKey } from "../srs/day";
import { applyRating, isDue, newCard, pickReviews, previewIntervals, type RatingName, type StoredCard } from "../srs/scheduler";
import { buildQuiz, type Question } from "../srs/quiz";
import { getDb } from "./db";
import { getSettings } from "./settings";
import { allWords, getWord, wordBank } from "./words";
import { removeFromQueue } from "./queue";
import { now as clockNow } from "./clock";

export type StepName = "review" | "learn" | "quiz" | "chat" | "summary";
export type StepStatus = "todo" | "done" | "skipped";
export const STEPS: StepName[] = ["review", "learn", "quiz", "chat", "summary"];

export interface DayState {
  day: string;
  steps: Record<StepName, StepStatus>;
  review?: { ids: number[]; queue: number[]; done: number[]; ratings: Record<string, RatingName[]> };
  learn?: { ids: number[]; done: number[] };
  quiz?: {
    questions: Question[];
    queue: string[];
    answers: { qid: string; correct: boolean; given: string }[];
    silent: boolean;
  };
  chat?: { conversationId: number | null; exchanges: number; target: number };
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
}

const nowIso = () => clockNow().toISOString();

export function today(now = clockNow()): string {
  return dayKey(now);
}

export function loadDay(day: string): DayState {
  const row = getDb().prepare("SELECT state FROM days WHERE day = ?").get(day) as { state: string } | undefined;
  if (row) return JSON.parse(row.state);
  return {
    day,
    steps: { review: "todo", learn: "todo", quiz: "todo", chat: "todo", summary: "todo" },
    startedAt: nowIso(),
    updatedAt: nowIso(),
  };
}

export function saveDay(s: DayState) {
  s.updatedAt = nowIso();
  const completed = STEPS.every((k) => s.steps[k] !== "todo");
  if (completed && !s.completedAt) s.completedAt = nowIso();
  getDb()
    .prepare(
      `INSERT INTO days (day, state, completed, completed_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(day) DO UPDATE SET state = excluded.state, completed = excluded.completed, completed_at = excluded.completed_at`,
    )
    .run(s.day, JSON.stringify(s), completed ? 1 : 0, s.completedAt ?? null);
}

/* ------------------------------ cards ------------------------------ */

interface CardRow {
  word_id: number;
  card: string;
  due: string;
  last_rated_day: string | null;
}

export function getCard(wordId: number): { card: StoredCard; lastRatedDay: string | null } | null {
  const r = getDb().prepare("SELECT * FROM cards WHERE word_id = ?").get(wordId) as CardRow | undefined;
  return r ? { card: JSON.parse(r.card), lastRatedDay: r.last_rated_day } : null;
}

function putCard(wordId: number, card: StoredCard, lastRatedDay: string | null) {
  getDb()
    .prepare(
      `INSERT INTO cards (word_id, card, due, last_rated_day) VALUES (?, ?, ?, ?)
       ON CONFLICT(word_id) DO UPDATE SET card = excluded.card, due = excluded.due, last_rated_day = excluded.last_rated_day`,
    )
    .run(wordId, JSON.stringify(card), card.due, lastRatedDay);
}

/** Rate a word; only the first rating of the day reschedules it. */
export function rateWord(wordId: number, rating: RatingName, day: string, source: "review" | "quiz", now = clockNow()) {
  const cur = getCard(wordId);
  if (!cur) return { counted: false };
  const res = applyRating(cur.card, cur.lastRatedDay, day, rating, now);
  if (res.counted) putCard(wordId, res.card, day);
  getDb()
    .prepare("INSERT INTO review_log (word_id, day, rating, source, counted, at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(wordId, day, ["again", "hard", "good", "easy"].indexOf(rating) + 1, source, res.counted ? 1 : 0, now.toISOString());
  return { counted: res.counted };
}

export function learnedOnDay(day: string): number[] {
  return (getDb().prepare("SELECT word_id FROM learned WHERE day = ? ORDER BY at").all(day) as { word_id: number }[]).map(
    (r) => r.word_id,
  );
}

export function isLearned(wordId: number): boolean {
  return Boolean(getDb().prepare("SELECT 1 FROM learned WHERE word_id = ?").get(wordId));
}

/** Cards due today (not counting words learned today), most overdue first. */
export function dueCards(day: string, max = Infinity): { wordId: number; card: StoredCard }[] {
  const rows = getDb()
    .prepare("SELECT c.word_id, c.card FROM cards c JOIN learned l ON l.word_id = c.word_id WHERE l.day < ?")
    .all(day) as { word_id: number; card: string }[];
  const cards = rows.map((r) => ({ wordId: r.word_id, card: JSON.parse(r.card) as StoredCard }));
  return pickReviews(cards, day, max === Infinity ? cards.length : max);
}

export function dueCount(day: string): number {
  return dueCards(day).length;
}

/* ------------------------------ review ------------------------------ */

export function startReview(day: string): DayState {
  const s = loadDay(day);
  if (!s.review) {
    const { maxReviews } = getSettings();
    const ids = dueCards(day, maxReviews).map((c) => c.wordId);
    s.review = { ids, queue: [...ids], done: [], ratings: {} };
    if (!ids.length) s.steps.review = "skipped";
    saveDay(s);
  }
  return s;
}

export function reviewRate(day: string, wordId: number, rating: RatingName): DayState {
  const s = startReview(day);
  const r = s.review!;
  if (r.queue[0] !== wordId && !r.queue.includes(wordId)) return s;
  rateWord(wordId, rating, day, "review");
  r.ratings[wordId] = [...(r.ratings[wordId] ?? []), rating];
  r.queue.splice(r.queue.indexOf(wordId), 1);
  if (rating === "again") r.queue.push(wordId); // comes back at the end of the step
  else if (!r.done.includes(wordId)) r.done.push(wordId);
  if (!r.queue.length && s.steps.review === "todo") s.steps.review = "done";
  saveDay(s);
  return s;
}

/** interval previews for the rating buttons */
export function reviewPreview(wordId: number, day: string) {
  const c = getCard(wordId);
  if (!c) return null;
  if (c.lastRatedDay === day) return null; // repeats don't reschedule
  return previewIntervals(c.card, clockNow());
}

/* ------------------------------ learn ------------------------------ */

/** New words for today: queued words first, then the word bank in frequency order. */
export function pickNewWords(count: number): number[] {
  if (count <= 0) return [];
  const db = getDb();
  const learned = new Set((db.prepare("SELECT word_id FROM learned").all() as { word_id: number }[]).map((r) => r.word_id));
  const queued = (db.prepare("SELECT word_id FROM queue ORDER BY added_at").all() as { word_id: number }[])
    .map((r) => r.word_id)
    .filter((id) => !learned.has(id) && getWord(id));
  const out: number[] = queued.slice(0, count);
  for (const w of wordBank().words) {
    if (out.length >= count) break;
    if (!learned.has(w.id) && !out.includes(w.id)) out.push(w.id);
  }
  return out;
}

export function startLearn(day: string): DayState {
  const s = loadDay(day);
  if (!s.learn) {
    const ids = pickNewWords(getSettings().newPerDay);
    s.learn = { ids, done: [] };
    if (!ids.length) s.steps.learn = "skipped";
    saveDay(s);
  }
  return s;
}

/** Mark a word as learned: it now shows as plain German and gets a review card (due tomorrow). */
export function markLearned(wordId: number, day: string, now = clockNow()) {
  const db = getDb();
  db.transaction(() => {
    db.prepare("INSERT INTO learned (word_id, day, at) VALUES (?, ?, ?) ON CONFLICT(word_id) DO NOTHING").run(
      wordId,
      day,
      now.toISOString(),
    );
    if (!getCard(wordId)) putCard(wordId, newCard(day, now), null);
    removeFromQueue(wordId);
  })();
}

export function learnDone(day: string, wordId: number): DayState {
  const s = startLearn(day);
  const l = s.learn!;
  if (!l.ids.includes(wordId)) return s;
  markLearned(wordId, day);
  if (!l.done.includes(wordId)) l.done.push(wordId);
  if (l.ids.every((id) => l.done.includes(id)) && s.steps.learn === "todo") s.steps.learn = "done";
  saveDay(s);
  return s;
}

/* ------------------------------ quiz ------------------------------ */

export function startQuiz(day: string, silent: boolean): DayState {
  const s = loadDay(day);
  if (!s.quiz || (s.quiz.answers.length === 0 && s.quiz.silent !== silent)) {
    const todayIds = learnedOnDay(day);
    const todayWords = todayIds.map((id) => getWord(id)).filter((w): w is Word => Boolean(w));
    if (!todayWords.length) {
      s.quiz = { questions: [], queue: [], answers: [], silent };
      s.steps.quiz = "skipped";
    } else {
      const learnedAll = (getDb().prepare("SELECT word_id FROM learned").all() as { word_id: number }[])
        .map((r) => r.word_id)
        .filter((id) => !todayIds.includes(id))
        .map((id) => getWord(id))
        .filter((w): w is Word => Boolean(w));
      const maxRank = Math.max(...todayWords.map((w) => w.rank));
      const fallback = allWords().filter((w) => w.rank <= maxRank + 200 && !todayIds.includes(w.id));
      const questions = buildQuiz({ day, today: todayWords, learned: learnedAll, fallback, silent });
      s.quiz = { questions, queue: questions.map((q) => q.id), answers: [], silent };
    }
    saveDay(s);
  }
  return s;
}

export function quizAnswer(day: string, qid: string, correct: boolean, given: string): DayState {
  const s = loadDay(day);
  const q = s.quiz;
  if (!q || q.queue[0] !== qid) return s;
  q.answers.push({ qid, correct, given: given.slice(0, 200) });
  q.queue.shift();
  if (!correct) {
    q.queue.push(qid); // asked again at the end
    const question = q.questions.find((x) => x.id === qid);
    if (question) rateWord(question.wordId, "again", day, "quiz");
  }
  if (!q.queue.length && s.steps.quiz === "todo") s.steps.quiz = "done";
  saveDay(s);
  return s;
}

/** First-try score: questions answered correctly on the first attempt. */
export function quizScore(s: DayState): { correct: number; total: number } {
  const q = s.quiz;
  if (!q) return { correct: 0, total: 0 };
  const first = new Map<string, boolean>();
  for (const a of q.answers) if (!first.has(a.qid)) first.set(a.qid, a.correct);
  return { correct: [...first.values()].filter(Boolean).length, total: q.questions.length };
}

export function setStep(day: string, step: StepName, status: StepStatus): DayState {
  const s = loadDay(day);
  s.steps[step] = status;
  saveDay(s);
  return s;
}

/** Days with every step completed. */
export function completedDays(): string[] {
  return (getDb().prepare("SELECT day FROM days WHERE completed = 1").all() as { day: string }[]).map((r) => r.day);
}

export { isDue };
