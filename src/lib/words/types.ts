import type { Pos } from "../dict/types";

export type Cefr = "A1" | "A2" | "B1";
export type NounGender = "m" | "f" | "n" | "pl";

export const TOPICS = [
  "basics",
  "people",
  "food",
  "home",
  "city",
  "travel",
  "time",
  "numbers",
  "body",
  "nature",
  "work",
  "free-time",
  "feelings",
  "communication",
  "society",
  "actions",
  "qualities",
  "abstract",
] as const;
export type Topic = (typeof TOPICS)[number];

export interface NounData {
  gender: NounGender;
  /** "der" | "die" | "das" (plural-only nouns: "die") */
  article: "der" | "die" | "das";
  /** nominative plural, null = no plural */
  plural: string | null;
  genitive?: string;
  pluralOnly?: boolean;
}

export interface VerbData {
  /** 3rd person singular present (er geht, er ruft an) */
  present3: string;
  /** Präteritum 3rd person singular */
  past3: string;
  /** Partizip II */
  participle: string;
  aux: "haben" | "sein" | "haben/sein";
  separable?: string;
  reflexive?: boolean;
  irregular: boolean;
}

export interface AdjData {
  comparative?: string;
  superlative?: string;
}

export interface Example {
  de: string;
  en: string;
  /** true when validation could not make it perfect */
  flagged?: boolean;
  /** words in the sentence ranked after this word (from validation) */
  later?: string[];
}

export interface Word {
  /** stable id (never reused); progress refers to it */
  id: number;
  /** unique "lemma|pos" */
  key: string;
  lemma: string;
  /** how the word is shown: "der Tisch", "sich freuen", "der, die, das" */
  display: string;
  pos: Pos;
  /** short English meanings; meanings[0] is the gloss */
  meanings: string[];
  cefr: Cefr;
  /** frequency rank, 1 = most common */
  rank: number;
  topic: Topic;
  ipa?: string;
  example?: Example;
  noun?: NounData;
  verb?: VerbData;
  adj?: AdjData;
  /** function-word families: lowercase form -> gloss */
  forms?: Record<string, string>;
  /** dictionary entry ids with this lemma (any part of speech) */
  dictIds?: number[];
  /** share of running German text made up of this word's forms (0..1) */
  share: number;
}

export interface WordBank {
  version: number;
  built: string;
  sources: string[];
  words: Word[];
}
