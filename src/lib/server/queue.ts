/**
 * The learning queue (words picked from the chat or the game, learned first
 * in the next Learn step) and custom words made from dictionary entries.
 */
import "server-only";
import type { DictEntry } from "../dict/types";
import type { Word } from "../words/types";
import { getDb } from "./db";
import { dictEntry, entriesByLemma } from "./dictionary-db";
import { CUSTOM_ID_START, getWord, invalidateWords, wordIndex } from "./words";
import { shortGlossText } from "../german/analyze";
import { now as clockNow } from "./clock";

function nowIso() {
  return clockNow().toISOString();
}

/** Turn a dictionary entry into a custom word (or return the existing word for it). */
export function ensureWordForDict(dictId: number): Word | null {
  const idx = wordIndex();
  const existing = idx.byDictId.get(dictId);
  if (existing) return existing;
  const e = dictEntry(dictId);
  if (!e) return null;
  const sameLemma = idx.byLemma.get(e.w)?.find((w) => w.pos === e.p);
  if (sameLemma) return sameLemma;
  const db = getDb();
  const row = db.prepare("SELECT MAX(id) AS m FROM custom_words").get() as { m: number | null };
  const id = Math.max(CUSTOM_ID_START, (row.m ?? CUSTOM_ID_START - 1) + 1);
  const word = customWordFromEntry(e, id);
  db.prepare("INSERT INTO custom_words (id, key, data, created_at) VALUES (?, ?, ?, ?)").run(
    id,
    word.key,
    JSON.stringify(word),
    nowIso(),
  );
  invalidateWords();
  return word;
}

export function customWordFromEntry(e: DictEntry, id: number): Word {
  const all = entriesByLemma(e.w);
  const w: Word = {
    id,
    key: `${e.w}|${e.p}`,
    lemma: e.w,
    display: e.w,
    pos: e.p,
    meanings: e.m.slice(0, 3).map((m) => shortGlossText(m.replace(/^\(refl\.\)\s*/, ""), false)),
    cefr: "B1",
    rank: 100000,
    topic: "abstract",
    share: 0,
    dictIds: all.map((x) => x.id),
  };
  if (e.ipa) w.ipa = e.ipa;
  if (e.p === "noun" && e.g?.length) {
    const g = e.g[0];
    const article = g === "m" ? "der" : g === "n" ? "das" : "die";
    w.noun = {
      gender: g,
      article,
      plural: g === "pl" ? e.w : (e.noun?.pl?.[0] ?? null),
    };
    if (e.noun?.gs?.[0]) w.noun.genitive = e.noun.gs[0];
    if (g === "pl") w.noun.pluralOnly = true;
    w.display = `${article} ${e.w}`;
  }
  if (e.p === "verb" && e.verb) {
    w.verb = {
      present3: e.verb.p3 ?? e.w,
      past3: e.verb.pt ?? "",
      participle: e.verb.pp ?? "",
      aux: e.verb.aux?.length === 2 ? "haben/sein" : (e.verb.aux?.[0] ?? "haben"),
      irregular: Boolean(e.verb.irr),
    };
    if (e.verb.sep) w.verb.separable = e.verb.sep;
    if (e.verb.refl) {
      w.verb.reflexive = true;
      w.display = `sich ${e.w}`;
    }
  }
  if (e.p === "adj" && e.adj) {
    w.adj = {};
    if (e.adj.cmp?.[0]) w.adj.comparative = e.adj.cmp[0];
    if (e.adj.sup?.[0]) w.adj.superlative = `am ${e.adj.sup[0]}`;
  }
  return w;
}

export function isQueued(wordId: number): boolean {
  return Boolean(getDb().prepare("SELECT 1 FROM queue WHERE word_id = ?").get(wordId));
}

export function addToQueue(wordId: number, source: string) {
  getDb()
    .prepare("INSERT INTO queue (word_id, added_at, source) VALUES (?, ?, ?) ON CONFLICT(word_id) DO NOTHING")
    .run(wordId, nowIso(), source);
}

export function removeFromQueue(wordId: number) {
  getDb().prepare("DELETE FROM queue WHERE word_id = ?").run(wordId);
}

export function queuedWords(): Word[] {
  const rows = getDb().prepare("SELECT word_id FROM queue ORDER BY added_at").all() as { word_id: number }[];
  return rows.map((r) => getWord(r.word_id)).filter((w): w is Word => Boolean(w));
}
