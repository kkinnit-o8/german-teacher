/**
 * Example sentence validation with the app's own analyzer: is the target word
 * in the sentence, and which words are ranked after the target?
 */
import { analyze } from "../../src/lib/german/analyze";
import { makeWordLookup, wordToRef } from "../../src/lib/german/lookup";
import type { Lexicon, WordLookup } from "../../src/lib/german/types";
import { dictEntry, lookupForm } from "../../src/lib/server/dictionary-db";
import type { Word } from "../../src/lib/words/types";

export const dbLexicon: Lexicon = {
  lookup: (l) =>
    lookupForm(l).flatMap((r) => {
      const e = dictEntry(r.entry_id);
      return e ? [{ entry: e, code: r.code, form: r.form }] : [];
    }),
};

export interface ExampleCheck {
  key: string;
  rank: number;
  de: string;
  /** target word found in the sentence */
  hasTarget: boolean;
  /** lemmas of word bank words ranked after the target */
  later: string[];
  /** German words that are not in the word bank at all */
  outside: string[];
}

export function lookupFor(words: Word[]): WordLookup {
  return makeWordLookup(words.map(wordToRef));
}

export function checkExample(word: Word, de: string, lookup: WordLookup): ExampleCheck {
  const a = analyze(de, dbLexicon, lookup);
  let hasTarget = false;
  const later = new Set<string>();
  const outside = new Set<string>();
  for (const t of a.tokens) {
    if (t.k !== "w" || t.name || t.foreign) continue;
    const refs = [t.w, ...(t.parts ?? [])].filter(Boolean);
    if (refs.some((r) => r!.wid === word.id)) hasTarget = true;
    // a separable verb's particle counts with its verb; compounds count by their parts
    const counted = t.pt === "compound" ? (t.parts ?? []) : t.pt === "contraction" || t.pt === "clitic" ? (t.parts ?? []) : [t.w];
    for (const r of counted) {
      if (!r) continue;
      if (r.wid === word.id) continue;
      const other = r.wid ? lookup.byId(r.wid) : undefined;
      if (other) {
        if (other.rank > word.rank) later.add(other.lemma);
      } else if (t.role !== "particle") {
        outside.add(r.lemma);
      }
    }
    if (t.unknown) outside.add(t.t);
  }
  // fallback: the surface contains the lemma itself (e.g. a family or an unusual form)
  if (!hasTarget && word.forms) {
    const lower = de.toLowerCase();
    hasTarget = Object.keys(word.forms).some((f) => new RegExp(`\\b${f}\\b`, "u").test(lower));
  }
  return { key: word.key, rank: word.rank, de, hasTarget, later: [...later], outside: [...outside] };
}

/** Lower is better: a missing target is much worse than a later word. */
export function problemScore(c: ExampleCheck): number {
  return (c.hasTarget ? 0 : 100) + c.later.length * 2 + c.outside.length;
}
