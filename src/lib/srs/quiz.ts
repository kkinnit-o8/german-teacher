/**
 * The quick check: a short quiz on today's words. Mixes German → meaning,
 * audio → German, meaning → German (typed) and der/die/das for nouns.
 * Wrong options come from other learned words. In silent mode, listening
 * questions become reading questions (meaning → pick the German word).
 */
import type { Word } from "../words/types";
import type { AnswerTarget } from "./answers";

export type QuestionKind = "de2en" | "audio2de" | "en2de_mc" | "en2de" | "gender";

export interface Question {
  id: string;
  kind: QuestionKind;
  wordId: number;
  /** what is shown (German word, or English meaning) */
  prompt: string;
  /** text to speak for audio questions */
  audio?: string;
  options?: string[];
  /** correct option, or the expected typed answer */
  answer: string;
  /** typed questions */
  target?: AnswerTarget;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFrom(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function shuffle<T>(xs: T[], rnd: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const meaningOf = (w: Word) => w.meanings[0];

/** up to n distractors from the pool: same part of speech first, no duplicates of the answer */
function distractors(word: Word, pool: Word[], n: number, rnd: () => number, key: (w: Word) => string): string[] {
  const answer = key(word).toLowerCase();
  const seen = new Set([answer]);
  const out: string[] = [];
  const same = shuffle(pool.filter((w) => w.id !== word.id && w.pos === word.pos), rnd);
  const other = shuffle(pool.filter((w) => w.id !== word.id && w.pos !== word.pos), rnd);
  for (const w of [...same, ...other]) {
    const k = key(w);
    if (!k || seen.has(k.toLowerCase())) continue;
    seen.add(k.toLowerCase());
    out.push(k);
    if (out.length >= n) break;
  }
  return out;
}

export interface QuizInput {
  day: string;
  today: Word[];
  /** other learned words (for wrong options) */
  learned: Word[];
  /** fallback pool if too few words are learned */
  fallback: Word[];
  silent: boolean;
}

export function buildQuiz(input: QuizInput): Question[] {
  const rnd = mulberry32(seedFrom(input.day + ":" + input.today.map((w) => w.id).join(",")));
  const pool = [...input.learned, ...input.today];
  const ensurePool = (w: Word, n: number, key: (w: Word) => string) => {
    let ds = distractors(w, pool, n, rnd, key);
    if (ds.length < n) {
      const more = distractors(w, input.fallback, n + ds.length, rnd, key).filter((x) => !ds.includes(x));
      ds = [...ds, ...more].slice(0, n);
    }
    return ds;
  };
  const cycle: QuestionKind[] = ["de2en", "audio2de", "en2de"];
  const qs: Question[] = [];
  input.today.forEach((w, i) => {
    let kind = cycle[i % cycle.length];
    if (kind === "audio2de" && input.silent) kind = "en2de_mc";
    const id = `${w.id}:${kind}`;
    if (kind === "de2en") {
      const options = shuffle([meaningOf(w), ...ensurePool(w, 3, meaningOf)], rnd);
      qs.push({ id, kind, wordId: w.id, prompt: w.display, options, answer: meaningOf(w) });
    } else if (kind === "audio2de") {
      const options = shuffle([w.display, ...ensurePool(w, 3, (x) => x.display)], rnd);
      const audio = w.noun ? `${w.noun.article} ${w.lemma}` : w.lemma;
      qs.push({ id, kind, wordId: w.id, prompt: "Listen and pick the word", audio, options, answer: w.display });
    } else if (kind === "en2de_mc") {
      const options = shuffle([w.display, ...ensurePool(w, 3, (x) => x.display)], rnd);
      qs.push({ id, kind, wordId: w.id, prompt: meaningOf(w), options, answer: w.display });
    } else {
      const target: AnswerTarget = { lemma: w.lemma };
      if (w.noun && !w.noun.pluralOnly) target.article = w.noun.article;
      if (w.verb?.reflexive) target.reflexive = true;
      if (w.forms) target.alternatives = Object.keys(w.forms);
      qs.push({ id, kind, wordId: w.id, prompt: meaningOf(w), answer: w.display, target });
    }
    if (w.noun && !w.noun.pluralOnly) {
      qs.push({
        id: `${w.id}:gender`,
        kind: "gender",
        wordId: w.id,
        prompt: w.lemma,
        options: ["der", "die", "das"],
        answer: w.noun.article,
      });
    }
  });
  // spread the questions about one word apart
  return shuffle(qs, rnd);
}
