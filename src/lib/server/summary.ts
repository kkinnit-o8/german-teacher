/**
 * The end-of-day summary.
 */
import "server-only";
import type { Correction } from "../teacher/response";
import { usedWordIds } from "../german/render";
import { computeStreak, type Streak } from "../srs/day";
import { analyzeText } from "./analysis";
import { chatWords, getConversation, type ChatWord } from "./chat";
import { completedDays, learnedOnDay, loadDay, quizScore, saveDay, STEPS, type DayState } from "./session";
import { getWord } from "./words";

export interface DaySummary {
  day: string;
  state: DayState;
  learned: { id: number; display: string; meaning: string; gender?: string; usedByTeacher: boolean; usedByMe: boolean }[];
  quiz: { correct: number; total: number };
  reviews: number;
  corrections: { said: string; correction: Correction }[];
  chatWords: ChatWord[];
  exchanges: number;
  cost: number;
  streak: Streak;
  /** every step except the summary is finished */
  ready: boolean;
  /** this visit finished the day */
  justCompleted: boolean;
}

/** All steps before the summary are done (or were skipped automatically). */
export function readyForSummary(s: DayState): boolean {
  return STEPS.filter((k) => k !== "summary").every((k) => s.steps[k] !== "todo");
}

export function daySummary(day: string, markDone: boolean): DaySummary {
  const s = loadDay(day);
  const ready = readyForSummary(s);
  let justCompleted = false;
  if (markDone && ready && s.steps.summary === "todo") {
    s.steps.summary = "done";
    saveDay(s);
    justCompleted = true;
  }
  const conv = s.chat?.conversationId ? getConversation(s.chat.conversationId) : null;
  const byTeacher = new Set<number>();
  const byMe = new Set<number>();
  const corrections: DaySummary["corrections"] = [];
  for (const m of conv?.messages ?? []) {
    if (m.role === "teacher" && !m.raw) for (const id of usedWordIds(m.analysis ?? analyzeText(m.text))) byTeacher.add(id);
    if (m.role === "user") {
      for (const id of usedWordIds(analyzeText(m.text))) byMe.add(id);
      if (m.correction?.corrected) for (const id of usedWordIds(analyzeText(m.correction.corrected))) byMe.add(id);
      if (m.correction) corrections.push({ said: m.text, correction: m.correction });
    }
  }
  const learned = learnedOnDay(day)
    .map((id) => getWord(id))
    .filter((w): w is NonNullable<typeof w> => Boolean(w))
    .map((w) => ({
      id: w.id,
      display: w.display,
      meaning: w.meanings[0],
      gender: w.noun?.gender,
      usedByTeacher: byTeacher.has(w.id),
      usedByMe: byMe.has(w.id),
    }));
  return {
    day,
    state: s,
    learned,
    quiz: quizScore(s),
    reviews: s.review?.done.length ?? 0,
    corrections,
    chatWords: conv ? chatWords(conv.id) : [],
    exchanges: conv?.exchanges ?? 0,
    cost: conv?.cost ?? 0,
    streak: computeStreak(completedDays(), day),
    ready,
    justCompleted,
  };
}
