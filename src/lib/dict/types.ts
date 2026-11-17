/**
 * Compact dictionary format shared by the build scripts (scripts/build-dict.ts),
 * the SQLite import and the lemmatizer.
 *
 * Source: German entries of English Wiktionary, extracted by kaikki.org /
 * wiktextract (CC BY-SA 4.0 and GFDL). See README "Data sources".
 */

export type Pos =
  | "noun"
  | "verb"
  | "adj"
  | "adv"
  | "pron"
  | "det"
  | "art"
  | "prep"
  | "conj"
  | "num"
  | "part"
  | "intj"
  | "phrase"
  | "name";

/** Gender of a noun. "pl" = plural-only noun (die Eltern). */
export type Gender = "m" | "f" | "n" | "pl";

/**
 * Compact form codes. Nouns: case+number (ns gs ds as np gp dp ap).
 * Verbs: inf, zu (zu-infinitive), pp (past participle), prp (present participle),
 * pr1s..pr3p (present), pt1s..pt3p (preterite), k2_1s..k2_3p (subjunctive II),
 * k1_1s..k1_3p (subjunctive I), imp2s, imp2p.
 * Adjectives: dec (declined positive), cmp (comparative, any ending), sup (superlative).
 * Any: alt (alternative spelling), dim (diminutive).
 */
export type FormCode = string;

export interface VerbInfo {
  /** 3rd person singular present, e.g. "geht", "ruft an" */
  p3?: string;
  /** Präteritum 3rd person singular, e.g. "ging", "rief an" */
  pt?: string;
  /** Partizip II, e.g. "gegangen", "angerufen" */
  pp?: string;
  /** auxiliary verb(s) */
  aux?: ("haben" | "sein")[];
  /** separable prefix, e.g. "an" for anrufen */
  sep?: string;
  /** true if the main meanings are reflexive (sich freuen) */
  refl?: boolean;
  /** strong, mixed or irregular */
  irr?: boolean;
}

export interface NounInfo {
  /** genitive singular forms */
  gs?: string[];
  /** plural forms (nominative) */
  pl?: string[];
  /** true if the noun has no plural */
  noPl?: boolean;
}

export interface AdjInfo {
  cmp?: string[];
  sup?: string[];
}

export interface DictEntry {
  /** stable id within one dictionary build (line number) */
  id: number;
  /** lemma as written (nouns capitalised) */
  w: string;
  p: Pos;
  /** noun gender(s), first is the main one */
  g?: Gender[];
  ipa?: string;
  /** short English meanings, most important first */
  m: string[];
  /** usage labels such as "colloquial", "regional" */
  tg?: string[];
  verb?: VerbInfo;
  noun?: NounInfo;
  adj?: AdjInfo;
  /** inflected forms: [form, code]. Multi-word separable forms keep the space ("ruft an"). */
  f?: [string, FormCode][];
}
