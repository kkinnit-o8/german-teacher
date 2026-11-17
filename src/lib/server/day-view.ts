import "server-only";
import type { Word } from "../words/types";
import { getWord } from "./words";
import { dueCount, loadDay, quizScore, reviewPreview, today, type DayState } from "./session";

export interface DayView {
  day: string;
  state: DayState;
  dueCount: number;
  words: Record<number, Word>;
  preview?: Record<string, number> | null;
  score?: { correct: number; total: number };
}

/** The day state plus the word data the client needs to show it. */
export function dayView(state?: DayState): DayView {
  const day = state?.day ?? today();
  const s = state ?? loadDay(day);
  const ids = new Set<number>([
    ...(s.review?.ids ?? []),
    ...(s.learn?.ids ?? []),
    ...(s.quiz?.questions.map((q) => q.wordId) ?? []),
  ]);
  const words: Record<number, Word> = {};
  for (const id of ids) {
    const w = getWord(id);
    if (w) words[id] = w;
  }
  const view: DayView = { day, state: s, dueCount: s.review ? s.review.queue.length : dueCount(day), words };
  const cur = s.review?.queue[0];
  if (cur !== undefined) view.preview = reviewPreview(cur, day);
  if (s.quiz) view.score = quizScore(s);
  return view;
}
