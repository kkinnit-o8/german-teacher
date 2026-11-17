/**
 * Test helpers: the real dictionary (SQLite, see global-setup) and a small,
 * explicit word bank built from dictionary entries, so tests don't depend on
 * the contents of data/words.json.
 */
import { analyze } from "../../src/lib/german/analyze";
import { compoundFormsOf, resetCompoundCache } from "../../src/lib/german/compounds";
import { FAMILY_BY_KEY } from "../../src/lib/german/function-words";
import { makeWordLookup } from "../../src/lib/german/lookup";
import type { Analysis, LexHit, Lexicon, WordLookup, WordRef } from "../../src/lib/german/types";
import { dictEntry, entriesByLemma, lookupForm } from "../../src/lib/server/dictionary-db";
import type { Gender, Pos } from "../../src/lib/dict/types";

export const lexicon: Lexicon = {
  lookup(lower: string): LexHit[] {
    return lookupForm(lower).flatMap((r) => {
      const entry = dictEntry(r.entry_id);
      return entry ? [{ entry, code: r.code, form: r.form }] : [];
    });
  },
};

/** Build a word bank from "lemma|pos" keys (function families use their family key). */
export function makeWords(keys: string[]): WordLookup {
  resetCompoundCache();
  const refs: WordRef[] = keys.map((key, i) => {
    const fam = FAMILY_BY_KEY.get(key);
    if (fam) {
      return { id: i + 1, key, lemma: fam.lemma, pos: fam.pos, gloss: fam.meanings[0], forms: fam.forms, rank: i + 1 };
    }
    const [lemma, pos] = key.split("|");
    const entries = entriesByLemma(lemma);
    if (!entries.length) throw new Error(`no dictionary entry for ${key}`);
    const main = entries.find((e) => e.p === pos) ?? entries[0];
    const ref: WordRef = {
      id: i + 1,
      key,
      lemma,
      pos: pos as Pos,
      gloss: main.m[0],
      dictIds: entries.map((e) => e.id),
      rank: i + 1,
    };
    if (pos === "noun" && main.g?.[0]) ref.gender = main.g[0] as Gender;
    ref.compoundForms = compoundFormsOf({ lemma, pos, plural: main.noun?.pl?.[0] });
    return ref;
  });
  return makeWordLookup(refs);
}

export function ids(words: WordLookup, ...keys: string[]): Set<number> {
  return new Set(
    keys.map((k) => {
      const w = words.byKey(k);
      if (!w) throw new Error(`not in test word bank: ${k}`);
      return w.id;
    }),
  );
}

export function run(text: string, words: WordLookup): Analysis {
  return analyze(text, lexicon, words);
}

/** the analysed word tokens, for compact assertions */
export function wordsOf(a: Analysis) {
  return a.tokens.filter((t) => t.k === "w");
}

export function tok(a: Analysis, surface: string, nth = 0) {
  const list = a.tokens.filter((t) => t.t === surface);
  const t = list[nth];
  if (!t) throw new Error(`token "${surface}" not found in "${a.text}"`);
  return t;
}
