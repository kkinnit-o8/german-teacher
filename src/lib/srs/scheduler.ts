/**
 * Spaced repetition with FSRS (ts-fsrs), in whole days.
 *
 * Rules of this app:
 *  - A word gets a card when it is learned; the card is first due the next day.
 *  - Only the first rating of a word on a learning day changes its schedule.
 *    Later ratings that day (an "Again" card coming back at the end of the step,
 *    or a wrong quiz answer after a review) are logged but don't reschedule.
 *  - A card is due on day D if its due time is before the start of day D+1.
 */
import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type Grade } from "ts-fsrs";
import { nextDayStart } from "./day";

export type RatingName = "again" | "hard" | "good" | "easy";
export const RATING: Record<RatingName, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

export interface StoredCard {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  learning_steps: number;
  state: number;
  last_review?: string;
}

export function makeScheduler(fuzz = true) {
  return fsrs(generatorParameters({ enable_short_term: false, enable_fuzz: fuzz, request_retention: 0.9, maximum_interval: 3650 }));
}

const defaultScheduler = makeScheduler(true);

export function toStored(c: Card): StoredCard {
  return {
    due: c.due.toISOString(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    reps: c.reps,
    lapses: c.lapses,
    learning_steps: c.learning_steps,
    state: c.state,
    ...(c.last_review ? { last_review: c.last_review.toISOString() } : {}),
  };
}

export function fromStored(s: StoredCard): Card {
  return {
    ...s,
    due: new Date(s.due),
    last_review: s.last_review ? new Date(s.last_review) : undefined,
  } as Card;
}

/** A new card for a word learned on `day`: first due at the start of the next day. */
export function newCard(day: string, now = new Date()): StoredCard {
  const c = createEmptyCard(now);
  c.due = nextDayStart(day);
  return toStored(c);
}

export function isDue(card: StoredCard, day: string): boolean {
  return new Date(card.due).getTime() < nextDayStart(day).getTime();
}

/** Apply a rating; returns the new card. */
export function rate(card: StoredCard, rating: RatingName, now = new Date(), scheduler = defaultScheduler): StoredCard {
  const res = scheduler.next(fromStored(card), now, RATING[rating]);
  return toStored(res.card);
}

/** Days until the next review for each rating (for the buttons). */
export function previewIntervals(card: StoredCard, now = new Date(), scheduler = defaultScheduler): Record<RatingName, number> {
  const rec = scheduler.repeat(fromStored(card), now);
  const days = (g: Grade) => Math.max(1, rec[g].card.scheduled_days);
  return { again: days(Rating.Again), hard: days(Rating.Hard), good: days(Rating.Good), easy: days(Rating.Easy) };
}

/**
 * Decide what a rating does on a given day: the first rating of the day reschedules,
 * later ones don't.
 */
export function applyRating(
  card: StoredCard,
  lastRatedDay: string | null,
  day: string,
  rating: RatingName,
  now = new Date(),
  scheduler = defaultScheduler,
): { card: StoredCard; counted: boolean } {
  if (lastRatedDay === day) return { card, counted: false };
  return { card: rate(card, rating, now, scheduler), counted: true };
}

/** Pick today's review cards: due ones, most overdue first, capped. */
export function pickReviews<T extends { card: StoredCard }>(cards: T[], day: string, max: number): T[] {
  return cards
    .filter((c) => isDue(c.card, day))
    .sort((a, b) => new Date(a.card.due).getTime() - new Date(b.card.due).getTime())
    .slice(0, Math.max(0, max));
}
