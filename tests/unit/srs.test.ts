import { describe, expect, it } from "vitest";
import { addDays, computeStreak, dayKey, dayStart, nextDayStart } from "../../src/lib/srs/day";
import { applyRating, isDue, makeScheduler, newCard, pickReviews, previewIntervals, rate } from "../../src/lib/srs/scheduler";
import { checkTyped } from "../../src/lib/srs/answers";
import { buildQuiz } from "../../src/lib/srs/quiz";
import type { Word } from "../../src/lib/words/types";

const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min);
const sched = makeScheduler(false);

describe("day rollover at 04:00", () => {
  it("counts the night before 04:00 as the previous day", () => {
    expect(dayKey(at(2026, 11, 17, 3, 59))).toBe("2026-11-16");
    expect(dayKey(at(2026, 11, 17, 4, 0))).toBe("2026-11-17");
    expect(dayKey(at(2026, 11, 17, 23, 59))).toBe("2026-11-17");
    expect(dayKey(at(2026, 1, 1, 1, 0))).toBe("2025-12-31");
  });

  it("computes day boundaries", () => {
    expect(dayStart("2026-11-17").getTime()).toBe(at(2026, 11, 17, 4).getTime());
    expect(nextDayStart("2026-11-17").getTime()).toBe(at(2026, 11, 18, 4).getTime());
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("handles daylight saving time changes", () => {
    // Europe switches on the last Sunday of March/October; whatever the TZ, keys stay consecutive
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
  });
});

describe("streak", () => {
  it("counts consecutive completed days", () => {
    const s = computeStreak(["2026-11-15", "2026-11-16", "2026-11-17"], "2026-11-17");
    expect(s).toEqual({ current: 3, best: 3, completedToday: true });
  });

  it("is still alive today before the session is done", () => {
    const s = computeStreak(["2026-11-15", "2026-11-16"], "2026-11-17");
    expect(s.current).toBe(2);
    expect(s.completedToday).toBe(false);
  });

  it("breaks after a missed day and remembers the best run", () => {
    const s = computeStreak(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-15", "2026-11-17"], "2026-11-17");
    expect(s.current).toBe(1);
    expect(s.best).toBe(4);
  });

  it("is zero with nothing completed", () => {
    expect(computeStreak([], "2026-11-17").current).toBe(0);
  });
});

describe("scheduling", () => {
  it("a new card is first due the next day", () => {
    const c = newCard("2026-11-17", at(2026, 11, 17, 20));
    expect(isDue(c, "2026-11-17")).toBe(false);
    expect(isDue(c, "2026-11-18")).toBe(true);
  });

  it("good intervals grow, again resets to a day", () => {
    let c = newCard("2026-11-17", at(2026, 11, 17, 20));
    c = rate(c, "good", at(2026, 11, 18, 9), sched);
    const first = c.scheduled_days;
    expect(first).toBeGreaterThanOrEqual(2);
    c = rate(c, "good", new Date(c.due), sched);
    expect(c.scheduled_days).toBeGreaterThan(first);
    c = rate(c, "again", new Date(c.due), sched);
    expect(c.scheduled_days).toBeLessThanOrEqual(2);
    expect(c.lapses).toBe(1);
  });

  it("shows longer intervals for easier ratings", () => {
    const c = newCard("2026-11-17");
    const p = previewIntervals(c, at(2026, 11, 18, 9), sched);
    expect(p.again).toBeLessThanOrEqual(p.hard);
    expect(p.hard).toBeLessThanOrEqual(p.good);
    expect(p.good).toBeLessThan(p.easy);
  });

  it("only the first rating of the day changes the schedule", () => {
    const c = newCard("2026-11-17");
    const first = applyRating(c, null, "2026-11-18", "again", at(2026, 11, 18, 9), sched);
    expect(first.counted).toBe(true);
    const second = applyRating(first.card, "2026-11-18", "2026-11-18", "good", at(2026, 11, 18, 9, 5), sched);
    expect(second.counted).toBe(false);
    expect(second.card).toEqual(first.card);
  });

  it("caps reviews per day, most overdue first", () => {
    const cards = [5, 1, 3, 2, 4].map((d) => ({ id: d, card: { ...newCard("2026-11-01"), due: at(2026, 11, d, 10).toISOString() } }));
    const picked = pickReviews(cards, "2026-11-17", 3);
    expect(picked.map((c) => c.id)).toEqual([1, 2, 3]);
  });
});

describe("typed answers", () => {
  it("accepts ae/oe/ue/ss and any case", () => {
    expect(checkTyped("Strasse", { lemma: "Straße" }).ok).toBe(true);
    expect(checkTyped("muede", { lemma: "müde" }).ok).toBe(true);
    expect(checkTyped("SCHÖN", { lemma: "schön" }).ok).toBe(true);
    expect(checkTyped("schoen", { lemma: "schön" }).ok).toBe(true);
    expect(checkTyped("schon", { lemma: "schön" }).ok).toBe(false);
  });

  it("accepts nouns with or without article, but not a wrong article", () => {
    const t = { lemma: "Tisch", article: "der" };
    expect(checkTyped("Tisch", t).ok).toBe(true);
    expect(checkTyped("der tisch", t).ok).toBe(true);
    const r = checkTyped("die Tisch", t);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("article");
      expect(r.expected).toBe("der Tisch");
    }
  });

  it("accepts reflexive verbs with sich", () => {
    expect(checkTyped("sich freuen", { lemma: "freuen", reflexive: true }).ok).toBe(true);
    expect(checkTyped("freuen", { lemma: "freuen", reflexive: true }).ok).toBe(true);
  });

  it("rejects empty answers", () => {
    expect(checkTyped("  ", { lemma: "gut" }).ok).toBe(false);
  });
});

function w(id: number, lemma: string, pos: Word["pos"], meaning: string, extra: Partial<Word> = {}): Word {
  return {
    id,
    key: `${lemma}|${pos}`,
    lemma,
    display: lemma,
    pos,
    meanings: [meaning],
    cefr: "A1",
    rank: id,
    topic: "basics",
    share: 0,
    ...extra,
  };
}

describe("quiz", () => {
  const today = [
    w(1, "Tisch", "noun", "table", { display: "der Tisch", noun: { gender: "m", article: "der", plural: "Tische" } }),
    w(2, "essen", "verb", "to eat"),
    w(3, "gut", "adj", "good"),
    w(4, "Haus", "noun", "house", { display: "das Haus", noun: { gender: "n", article: "das", plural: "Häuser" } }),
  ];
  const learned = [w(10, "ich", "pron", "I"), w(11, "gehen", "verb", "to go"), w(12, "klein", "adj", "small"), w(13, "trinken", "verb", "to drink")];

  it("mixes question types and adds der/die/das for nouns", () => {
    const qs = buildQuiz({ day: "2026-11-17", today, learned, fallback: [], silent: false });
    const kinds = new Set(qs.map((q) => q.kind));
    expect(kinds.has("de2en")).toBe(true);
    expect(kinds.has("audio2de")).toBe(true);
    expect(kinds.has("en2de")).toBe(true);
    expect(qs.filter((q) => q.kind === "gender").map((q) => q.answer).sort()).toEqual(["das", "der"]);
  });

  it("takes wrong options from other learned words and includes the answer once", () => {
    const qs = buildQuiz({ day: "2026-11-17", today, learned, fallback: [], silent: false });
    for (const q of qs.filter((q) => q.options && q.kind !== "gender")) {
      expect(q.options!.filter((o) => o === q.answer).length).toBe(1);
      expect(new Set(q.options).size).toBe(q.options!.length);
      expect(q.options!.length).toBe(4);
    }
    const de2en = qs.find((q) => q.kind === "de2en")!;
    const allMeanings = [...today, ...learned].map((x) => x.meanings[0]);
    for (const o of de2en.options!) expect(allMeanings).toContain(o);
  });

  it("replaces listening questions in silent mode", () => {
    const qs = buildQuiz({ day: "2026-11-17", today, learned, fallback: [], silent: true });
    expect(qs.some((q) => q.kind === "audio2de")).toBe(false);
    expect(qs.some((q) => q.kind === "en2de_mc")).toBe(true);
  });

  it("is deterministic for a day", () => {
    const a = buildQuiz({ day: "2026-11-17", today, learned, fallback: [], silent: false });
    const b = buildQuiz({ day: "2026-11-17", today, learned, fallback: [], silent: false });
    expect(a).toEqual(b);
  });
});
