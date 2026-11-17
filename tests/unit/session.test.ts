import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryDb, getDb } from "../../src/lib/server/db";
import {
  dueCards,
  getCard,
  learnDone,
  loadDay,
  markLearned,
  pickNewWords,
  quizAnswer,
  quizScore,
  rateWord,
  reviewRate,
  completedDays,
  setStep,
  startLearn,
  startQuiz,
  startReview,
} from "../../src/lib/server/session";
import { saveSettings } from "../../src/lib/server/settings";
import { addToQueue } from "../../src/lib/server/queue";
import { wordBank } from "../../src/lib/server/words";
import { addDays } from "../../src/lib/srs/day";

const D1 = "2026-11-17";
const D2 = addDays(D1, 1);
const words = () => wordBank().words;

beforeEach(() => {
  useMemoryDb();
});

describe("learn step", () => {
  it("takes new words in frequency order", () => {
    saveSettings({ newPerDay: 5 });
    const s = startLearn(D1);
    expect(s.learn!.ids).toEqual(words().slice(0, 5).map((w) => w.id));
  });

  it("puts queued words first", () => {
    saveSettings({ newPerDay: 3 });
    const queued = words()[500];
    addToQueue(queued.id, "chat");
    expect(pickNewWords(3)[0]).toBe(queued.id);
  });

  it("marks a word learned with a card that is due tomorrow, and finishes the step", () => {
    saveSettings({ newPerDay: 2 });
    const s = startLearn(D1);
    for (const id of s.learn!.ids) learnDone(D1, id);
    const after = loadDay(D1);
    expect(after.steps.learn).toBe("done");
    expect(dueCards(D1)).toEqual([]);
    expect(dueCards(D2).map((c) => c.wordId).sort()).toEqual([...s.learn!.ids].sort());
  });

  it("skips the step when no new words are wanted", () => {
    saveSettings({ newPerDay: 0 });
    expect(startLearn(D1).steps.learn).toBe("skipped");
  });
});

describe("review step", () => {
  function learnSome(n: number, day = D1) {
    const ids = words()
      .slice(0, n)
      .map((w) => w.id);
    for (const id of ids) markLearned(id, day, new Date(2026, 10, 17, 20));
    return ids;
  }

  it("is skipped when nothing is due", () => {
    expect(startReview(D1).steps.review).toBe("skipped");
  });

  it("caps the number of reviews per day", () => {
    learnSome(8);
    saveSettings({ maxReviews: 10 });
    saveSettings({ maxReviews: 5 }); // minimum is clamped to 10
    const s = startReview(D2);
    expect(s.review!.ids.length).toBe(8);
    useMemoryDb();
    learnSome(30);
    saveSettings({ maxReviews: 10 });
    expect(startReview(D2).review!.ids.length).toBe(10);
  });

  it("brings 'again' cards back at the end, rescheduling only once", () => {
    const ids = learnSome(3);
    const s = startReview(D2);
    const first = s.review!.queue[0];
    let st = reviewRate(D2, first, "again");
    expect(st.review!.queue[st.review!.queue.length - 1]).toBe(first);
    const afterAgain = getCard(first)!.card;
    for (const id of st.review!.queue.slice(0, -1)) st = reviewRate(D2, id, "good");
    st = reviewRate(D2, first, "good");
    expect(st.steps.review).toBe("done");
    expect(getCard(first)!.card).toEqual(afterAgain); // the second rating didn't reschedule
    const logs = getDb().prepare("SELECT counted FROM review_log WHERE word_id = ? ORDER BY id").all(first) as { counted: number }[];
    expect(logs.map((l) => l.counted)).toEqual([1, 0]);
    expect(ids).toContain(first);
  });
});

describe("quick check", () => {
  it("asks about today's words, repeats wrong answers at the end and rates them Again", () => {
    saveSettings({ newPerDay: 4 });
    const s = startLearn(D1);
    for (const id of s.learn!.ids) learnDone(D1, id);
    let q = startQuiz(D1, false);
    const total = q.quiz!.questions.length;
    expect(total).toBeGreaterThanOrEqual(4);
    const firstQ = q.quiz!.queue[0];
    const wrongWord = q.quiz!.questions.find((x) => x.id === firstQ)!.wordId;
    q = quizAnswer(D1, firstQ, false, "nonsense");
    expect(q.quiz!.queue[q.quiz!.queue.length - 1]).toBe(firstQ);
    expect(getCard(wrongWord)!.lastRatedDay).toBe(D1);
    while (q.quiz!.queue.length) q = quizAnswer(D1, q.quiz!.queue[0], true, "ok");
    expect(q.steps.quiz).toBe("done");
    expect(quizScore(q)).toEqual({ correct: total - 1, total });
  });

  it("only the first rating of the day counts for a word", () => {
    const id = words()[0].id;
    markLearned(id, D1);
    expect(rateWord(id, "again", D2, "quiz").counted).toBe(true);
    expect(rateWord(id, "good", D2, "review").counted).toBe(false);
  });
});

describe("finishing a day", () => {
  it("counts a day when every step is finished, but not with a skipped conversation", () => {
    for (const step of ["review", "learn", "quiz", "chat"] as const) setStep(D1, step, step === "review" ? "skipped" : "done");
    expect(completedDays()).toEqual([]);
    setStep(D1, "summary", "done");
    expect(completedDays()).toEqual([D1]);
    for (const step of ["review", "learn", "quiz", "summary"] as const) setStep(D2, step, "done");
    setStep(D2, "chat", "skipped");
    expect(completedDays()).toEqual([D1]);
  });
});
