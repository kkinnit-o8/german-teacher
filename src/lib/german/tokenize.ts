/**
 * Tokenizer for German text: words, numbers, punctuation, whitespace and
 * "other" (URLs, e-mail addresses, emoji). Keeps every character, so joining
 * the token texts gives back the input exactly.
 */

export type TokenKind = "w" | "n" | "p" | "s" | "x";

export interface Token {
  t: string;
  k: TokenKind;
}

const LETTER = "A-Za-zÄÖÜäöüßÀ-ÖØ-öø-ÿĀ-ſẞ";
// words may contain inner hyphens (E-Mail) and apostrophes (geht's, hab')
const WORD = `[${LETTER}]+(?:[-'’][${LETTER}]+)*'?`;
const NUMBER = `\\d+(?:[.,:]\\d+)*(?:\\.(?=\\s|$))?`;
const URL = `(?:https?://|www\\.)\\S+|[\\w.+-]+@[\\w-]+\\.[\\w.]+`;
const RE = new RegExp(`(${URL})|(${NUMBER})|(${WORD})|(\\s+)|([.,;:!?¡¿…"„“”‚‘'’«»()\\[\\]{}–—/\\-*&%€$§+=<>|#@~^])|(.)`, "gu");

export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(text))) {
    if (m[1]) out.push({ t: m[1], k: "x" });
    else if (m[2]) out.push({ t: m[2], k: "n" });
    else if (m[3]) {
      let w = m[3];
      // a trailing apostrophe belongs to the word only for forms like hab' / geht's handled later
      if (w.endsWith("'") && !/[sS]'$/.test(w) && w.length > 1 && !/^(hab|geh|würd|hätt|könnt|wär)'$/i.test(w)) {
        out.push({ t: w.slice(0, -1), k: "w" }, { t: "'", k: "p" });
        continue;
      }
      out.push({ t: w, k: "w" });
    } else if (m[4]) out.push({ t: m[4], k: "s" });
    else if (m[5]) out.push({ t: m[5], k: "p" });
    else if (m[6]) out.push({ t: m[6], k: "x" });
  }
  // merge consecutive "other" characters (emoji sequences)
  const merged: Token[] = [];
  for (const tok of out) {
    const last = merged[merged.length - 1];
    if (last && last.k === "x" && tok.k === "x" && !/^(https?:|www\.)/.test(last.t)) last.t += tok.t;
    else merged.push({ ...tok });
  }
  return merged;
}

const SENTENCE_END = /^[.!?…:]$/;

/** Index of each word token -> true if it starts a sentence. */
export function sentenceStarts(tokens: Token[]): boolean[] {
  const res: boolean[] = new Array(tokens.length).fill(false);
  let atStart = true;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.k === "w" || tok.k === "n") {
      res[i] = atStart && tok.k === "w";
      atStart = false;
    } else if (tok.k === "p") {
      if (SENTENCE_END.test(tok.t)) atStart = true;
      // quotes/dashes keep the current state
    } else if (tok.k === "s" && /\n/.test(tok.t)) {
      atStart = true;
    }
  }
  return res;
}
