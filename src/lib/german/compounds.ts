/**
 * Splitting compounds into word bank words: Kinderzimmer = Kinder + Zimmer,
 * Arbeitsplatz = Arbeit + s + Platz, Schreibtisch = schreib(en) + Tisch.
 * A compound that is not in the word bank counts as known when every part is
 * learned (see render.ts).
 */
import type { WordLookup, WordRef } from "./types";

const LINKS = ["", "s", "es", "n", "en", "e", "er", "ens"];
const MIN_PART = 3;

interface Element {
  word: WordRef;
  /** can end a compound (nouns; adjectives for lowercase compounds) */
  head: boolean;
}

let cache: { words: WordLookup; index: Map<string, Element[]>; maxLen: number } | null = null;

/** lowercase compound elements of a word: lemma, plural, verb stem */
export function compoundFormsOf(w: {
  lemma: string;
  pos: string;
  plural?: string | null;
}): string[] {
  const l = w.lemma.toLowerCase();
  const out = new Set<string>();
  if (w.pos === "noun") {
    out.add(l);
    if (w.plural) {
      const p = w.plural.toLowerCase();
      out.add(p);
      if (!/[ns]$/.test(p)) out.add(p + "n");
    }
    out.add(l + "s");
  } else if (w.pos === "verb") {
    const stem = l.replace(/(e?n)$/, "");
    if (stem.length >= MIN_PART) out.add(stem);
  } else if (w.pos === "adj") {
    out.add(l);
  } else if (w.pos === "num" || w.pos === "adv" || w.pos === "prep") {
    if (l.length >= MIN_PART) out.add(l);
  }
  return [...out];
}

function buildIndex(words: WordLookup) {
  if (cache && cache.words === words) return cache;
  const index = new Map<string, Element[]>();
  let maxLen = 0;
  for (const w of words.all()) {
    if (w.forms) continue; // function-word families are never compound parts
    const forms = w.compoundForms ?? compoundFormsOf({ lemma: w.lemma, pos: w.pos });
    for (const f of forms) {
      if (f.length < MIN_PART) continue;
      const head = w.pos === "noun" || w.pos === "adj";
      const list = index.get(f) ?? [];
      if (!list.some((e) => e.word.id === w.id)) list.push({ word: w, head });
      index.set(f, list);
      maxLen = Math.max(maxLen, f.length);
    }
  }
  cache = { words, index, maxLen };
  return cache;
}

/**
 * Split a word into word bank words (2-4 parts), or null.
 * Capitalised words must end in a noun; lowercase words in an adjective.
 */
export function splitCompound(surface: string, words: WordLookup): WordRef[] | null {
  if (surface.length < 2 * MIN_PART) return null;
  if (surface.includes("-")) {
    // Bindestrich-Komposita: E-Mail-Adresse, Kaffee-Tasse
    const parts = surface.split("-").filter(Boolean);
    const out: WordRef[] = [];
    for (const p of parts) {
      const direct = buildIndex(words).index.get(p.toLowerCase());
      if (direct?.length) out.push(direct[0].word);
      else {
        const sub = splitCompound(p, words);
        if (!sub) return null;
        out.push(...sub);
      }
    }
    return out.length > 1 ? out : null;
  }
  const { index, maxLen } = buildIndex(words);
  const s = surface.toLowerCase();
  const capital = surface[0] !== surface[0].toLowerCase();
  // best[i] = best split of s[0..i)
  type Path = { parts: Element[]; score: number };
  const best: (Path | null)[] = new Array(s.length + 1).fill(null);
  best[0] = { parts: [], score: 0 };
  for (let i = 0; i < s.length; i++) {
    const cur = best[i];
    if (!cur || cur.parts.length >= 4) continue;
    for (const link of i === 0 ? [""] : LINKS) {
      if (!s.startsWith(link, i)) continue;
      const startPart = i + link.length;
      for (let j = startPart + MIN_PART; j <= Math.min(s.length, startPart + maxLen); j++) {
        const piece = s.slice(startPart, j);
        const els = index.get(piece);
        if (!els) continue;
        for (const el of els) {
          // fewer parts is better; long parts are better; a linking element costs a little
          const score = cur.score - 10 + piece.length - (link ? 0.5 : 0);
          const prev = best[j];
          if (!prev || score > prev.score) best[j] = { parts: [...cur.parts, el], score };
        }
      }
    }
  }
  const res = best[s.length];
  if (!res || res.parts.length < 2) return null;
  const last = res.parts[res.parts.length - 1];
  if (capital && last.word.pos !== "noun") return null;
  if (!capital && last.word.pos !== "adj") return null;
  return res.parts.map((p) => p.word);
}

export function resetCompoundCache() {
  cache = null;
}
