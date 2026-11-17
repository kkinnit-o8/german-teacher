/**
 * Checking typed answers: case-insensitive, ä/ö/ü/ß may be typed as ae/oe/ue/ss,
 * punctuation ignored. Nouns may be typed with or without their article, but a
 * wrong article is wrong.
 */
import { normalizeAnswer } from "../words/format";

export interface AnswerTarget {
  lemma: string;
  /** "der" | "die" | "das" for nouns */
  article?: string;
  /** reflexive verbs may be typed with "sich" */
  reflexive?: boolean;
  /** extra accepted spellings */
  alternatives?: string[];
}

export type AnswerResult = { ok: true } | { ok: false; reason: "wrong" | "article"; expected: string };

export function checkTyped(input: string, target: AnswerTarget): AnswerResult {
  const given = normalizeAnswer(input);
  const lemma = normalizeAnswer(target.lemma);
  const expected = target.article ? `${target.article} ${target.lemma}` : target.reflexive ? `sich ${target.lemma}` : target.lemma;
  if (!given) return { ok: false, reason: "wrong", expected };
  const accepted = new Set([lemma, ...(target.alternatives ?? []).map(normalizeAnswer)]);
  if (accepted.has(given)) return { ok: true };
  if (target.reflexive && accepted.has(given.replace(/^sich /, ""))) return { ok: true };
  const m = given.match(/^(der|die|das|den|dem|des) (.+)$/);
  if (m && accepted.has(m[2])) {
    if (!target.article || m[1] === target.article) return { ok: true };
    return { ok: false, reason: "article", expected };
  }
  return { ok: false, reason: "wrong", expected };
}
