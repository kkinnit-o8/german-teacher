import type { DictEntry, Gender, Pos } from "../dict/types";

/** A dictionary hit for a lowercase word form. */
export interface LexHit {
  entry: DictEntry;
  /** form code, see dict/types FormCode; "lemma" if the form is the lemma itself */
  code: string;
  /** the form as stored (original case, may contain a space for "ruft an") */
  form: string;
}

/** Access to the dictionary (SQLite at runtime, in-memory in tests). */
export interface Lexicon {
  lookup(lower: string): LexHit[];
}

/** A word from the word bank or a custom word, as the analyzer needs it. */
export interface WordRef {
  id: number;
  key: string;
  lemma: string;
  pos: Pos;
  /** meanings[0] */
  gloss: string;
  gender?: Gender;
  /** function-word families: lowercase form -> gloss */
  forms?: Record<string, string>;
  dictIds?: number[];
  /** lowercase strings this word can appear as inside a compound (Kinder, zimmer, schreib) */
  compoundForms?: string[];
  rank: number;
}

export interface WordLookup {
  byId(id: number): WordRef | undefined;
  byKey(key: string): WordRef | undefined;
  byLemma(lemma: string): WordRef[];
  byDictId(id: number): WordRef | undefined;
  all(): WordRef[];
}

/** A resolved word (lemma) inside an analysed text. */
export interface WordInfo {
  lemma: string;
  pos: Pos;
  /** short English gloss of the lemma */
  gloss: string;
  /** word bank / custom word id */
  wid?: number;
  /** dictionary entry id */
  dict?: number;
  /** noun gender */
  g?: Gender;
}

export interface AToken {
  /** surface text */
  t: string;
  /** w = word, n = number, p = punctuation, s = space, x = other */
  k: "w" | "n" | "p" | "s" | "x";
  /** the resolved word */
  w?: WordInfo;
  /** parts of a contraction (im = in + dem), a clitic (geht's = geht + es) or a compound (Kinder + Zimmer) */
  parts?: WordInfo[];
  pt?: "contraction" | "clitic" | "compound" | "separable";
  /** gloss for this occurrence, if different from w.gloss ("(to) me", "in the") */
  gloss?: string;
  /** separable verb group: the verb and its particle share the number */
  grp?: number;
  role?: "verb" | "particle";
  /** proper name, English word or unknown word: shown unchanged */
  name?: true;
  foreign?: true;
  unknown?: true;
  /** colour class: noun gender, also given to agreeing articles */
  gc?: Gender;
  /** grammatical note for the popup ("past participle", "dative") */
  note?: string;
}

export interface Analysis {
  text: string;
  tokens: AToken[];
}
