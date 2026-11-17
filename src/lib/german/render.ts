/**
 * The core rule: plain German for learned words, glosses for the rest.
 * Pure functions over an Analysis and the set of learned word ids.
 */
import type { GlossMode } from "../settings";
import type { Gender } from "../dict/types";
import type { AToken, Analysis, WordInfo } from "./types";

export interface RenderToken {
  t: string;
  /** a German word that can be tapped */
  word: boolean;
  /** shown in the "unlearned" style */
  unlearned: boolean;
  /** gloss shown above the word (ruby), if any */
  gloss?: string;
  /** gender colour class */
  gc?: Gender;
  /** separable verb group */
  grp?: number;
  /** index into Analysis.tokens */
  i: number;
}

const known = (w: WordInfo | undefined, learned: ReadonlySet<number>) => !!w?.wid && learned.has(w.wid);

/** Is this word token known to the learner? */
export function isKnownToken(tok: AToken, learned: ReadonlySet<number>): boolean {
  if (tok.k !== "w") return true;
  if (tok.name || tok.foreign || tok.unknown) return true;
  if (tok.pt === "contraction" || tok.pt === "clitic") return !!tok.parts?.every((p) => known(p, learned));
  if (known(tok.w, learned)) return true;
  // compounds and separable verbs that are not in the word bank: known if all parts are learned
  if (tok.parts?.length && (tok.pt === "compound" || tok.pt === "separable")) {
    return tok.parts.every((p) => known(p, learned));
  }
  return false;
}

/** The gloss for a token: occurrence gloss first ("(to) me"), then the lemma's gloss. */
export function glossOf(tok: AToken): string | undefined {
  if (tok.role === "particle") return undefined; // the verb part carries the gloss
  return tok.gloss ?? tok.w?.gloss ?? undefined;
}

/** Is this a word token the renderer treats as German (marked/glossable/tappable)? */
export function isGermanWord(tok: AToken): boolean {
  return tok.k === "w" && !tok.name && !tok.foreign && !tok.unknown;
}

export function renderTokens(analysis: Analysis, learned: ReadonlySet<number>, mode: GlossMode): RenderToken[] {
  const out: RenderToken[] = [];
  // a separable verb counts as one word: both parts unlearned if either is
  const groupKnown = new Map<number, boolean>();
  for (const tok of analysis.tokens) {
    if (tok.grp) groupKnown.set(tok.grp, (groupKnown.get(tok.grp) ?? true) && isKnownToken(tok, learned));
  }
  analysis.tokens.forEach((tok, i) => {
    if (!isGermanWord(tok)) {
      out.push({ t: tok.t, word: tok.k === "w", unlearned: false, i });
      return;
    }
    const isKnown = tok.grp ? groupKnown.get(tok.grp)! : isKnownToken(tok, learned);
    const gloss = glossOf(tok);
    const show = mode === "all" || (mode === "unlearned" && !isKnown);
    const r: RenderToken = { t: tok.t, word: true, unlearned: !isKnown, i };
    if (show && gloss) r.gloss = gloss;
    if (tok.gc) r.gc = tok.gc;
    if (tok.grp) r.grp = tok.grp;
    out.push(r);
  });
  return out;
}

/** Unlearned German words in an analysis (for "Words from chat"), one entry per lemma. */
export function unlearnedWords(analysis: Analysis, learned: ReadonlySet<number>): AToken[] {
  const seen = new Set<string>();
  const out: AToken[] = [];
  for (const tok of analysis.tokens) {
    if (!isGermanWord(tok) || tok.role === "particle") continue;
    if (isKnownToken(tok, learned)) continue;
    const key = tok.w ? `${tok.w.lemma}|${tok.w.pos}` : tok.t;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tok);
  }
  return out;
}

/** Word bank ids used in an analysis (lemmas, contraction parts, compound parts). */
export function usedWordIds(analysis: Analysis): Set<number> {
  const ids = new Set<number>();
  for (const tok of analysis.tokens) {
    if (tok.w?.wid) ids.add(tok.w.wid);
    for (const p of tok.parts ?? []) if (p.wid && tok.pt !== "compound") ids.add(p.wid);
  }
  return ids;
}
