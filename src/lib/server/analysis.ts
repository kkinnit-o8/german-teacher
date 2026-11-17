/**
 * Server-side access to the analyzer: dictionary in SQLite, word bank in memory.
 */
import "server-only";
import { analyze, type AnalyzeOptions } from "../german/analyze";
import { makeWordLookup, wordToRef } from "../german/lookup";
import type { Analysis, LexHit, Lexicon, WordLookup } from "../german/types";
import { dictEntry, lookupForm } from "./dictionary-db";
import { allWords, wordIndex } from "./words";

const hitCache = new Map<string, LexHit[]>();

export const sqliteLexicon: Lexicon = {
  lookup(lower: string): LexHit[] {
    const hit = hitCache.get(lower);
    if (hit) return hit;
    const rows = lookupForm(lower);
    const out: LexHit[] = [];
    for (const r of rows) {
      const entry = dictEntry(r.entry_id);
      if (entry) out.push({ entry, code: r.code, form: r.form });
    }
    if (hitCache.size > 50000) hitCache.clear();
    hitCache.set(lower, out);
    return out;
  },
};

let lookupCache: { stamp: unknown; lookup: WordLookup } | null = null;

export function serverWordLookup(): WordLookup {
  const idx = wordIndex();
  if (lookupCache && lookupCache.stamp === idx) return lookupCache.lookup;
  const lookup = makeWordLookup(allWords().map(wordToRef));
  lookupCache = { stamp: idx, lookup };
  analysisCache.clear();
  return lookup;
}

const analysisCache = new Map<string, Analysis>();

export function analyzeText(text: string, opts: AnalyzeOptions = {}): Analysis {
  const words = serverWordLookup();
  const key = (opts.formal ? "F:" : "") + text;
  const hit = analysisCache.get(key);
  if (hit) return hit;
  const a = analyze(text, sqliteLexicon, words, opts);
  if (analysisCache.size > 3000) analysisCache.clear();
  analysisCache.set(key, a);
  return a;
}

export function analyzeMany(texts: string[], opts: AnalyzeOptions = {}): Analysis[] {
  return texts.map((t) => analyzeText(t, opts));
}
