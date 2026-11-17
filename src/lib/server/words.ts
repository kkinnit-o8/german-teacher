/**
 * The word bank (data/words.json) plus the learner's custom words, in memory.
 */
import "server-only";
import fs from "node:fs";
import type { Word, WordBank } from "../words/types";
import { WORDS_JSON } from "./paths";
import { getDb } from "./db";

let bank: { file: WordBank; mtime: number } | null = null;

export const CUSTOM_ID_START = 100000;

export function wordBank(): WordBank {
  const mtime = fs.existsSync(WORDS_JSON) ? fs.statSync(WORDS_JSON).mtimeMs : 0;
  if (bank && bank.mtime === mtime) return bank.file;
  const file: WordBank = mtime
    ? JSON.parse(fs.readFileSync(WORDS_JSON, "utf8"))
    : { version: 1, built: "", sources: [], words: [] };
  bank = { file, mtime };
  indexCache = null;
  return file;
}

export function customWords(): Word[] {
  const rows = getDb().prepare("SELECT data FROM custom_words ORDER BY id").all() as { data: string }[];
  return rows.map((r) => JSON.parse(r.data));
}

interface Index {
  byId: Map<number, Word>;
  byKey: Map<string, Word>;
  /** lemma (case-sensitive) -> words */
  byLemma: Map<string, Word[]>;
  /** dictionary entry id -> word */
  byDictId: Map<number, Word>;
  customCount: number;
}

let indexCache: Index | null = null;

export function wordIndex(): Index {
  const customs = customWords();
  wordBank();
  if (indexCache && indexCache.customCount === customs.length) return indexCache;
  const all = [...wordBank().words, ...customs];
  const idx: Index = {
    byId: new Map(),
    byKey: new Map(),
    byLemma: new Map(),
    byDictId: new Map(),
    customCount: customs.length,
  };
  for (const w of all) {
    idx.byId.set(w.id, w);
    idx.byKey.set(w.key, w);
    const l = idx.byLemma.get(w.lemma) ?? [];
    l.push(w);
    idx.byLemma.set(w.lemma, l);
    for (const d of w.dictIds ?? []) if (!idx.byDictId.has(d)) idx.byDictId.set(d, w);
  }
  indexCache = idx;
  return idx;
}

export function allWords(): Word[] {
  return [...wordBank().words, ...customWords()];
}

export function getWord(id: number): Word | undefined {
  return wordIndex().byId.get(id);
}

export function invalidateWords() {
  indexCache = null;
}
