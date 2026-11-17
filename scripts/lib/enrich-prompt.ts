/**
 * Instructions for the LLM step of the word bank build. Used for OpenRouter
 * calls in scripts/build-words.ts, and kept here so they can be reviewed.
 */
import { TOPICS } from "../../src/lib/words/types";

export const ENRICH_SYSTEM = `You are an experienced teacher of German as a foreign language and a careful lexicographer.
You review candidate entries for a word bank for complete beginners (CEFR A1-B1) whose native language is English.
The candidates come from a word-frequency list mapped to Wiktionary lemmas, so some are junk.

For every candidate, return one object with these fields:
- key: copy the candidate's key exactly.
- keep: false if the candidate should not be in a beginner word bank. Drop: proper names, abbreviations, English words,
  rare homographs that only exist because of lowercase spelling (e.g. "stunden" = to defer payment, really the plural of "Stunde";
  "haten"; "Als" = creek), nominalised adjectives/infinitives that duplicate another entry (Neues, Erster, das Haben),
  duplicates (gerne -> gern), vulgar words, very technical or administrative words. Keep everything a learner meets in everyday life.
- drop_reason: short reason when keep is false, otherwise null.
- lemma: the dictionary form, corrected if needed (nouns capitalised). For reflexive verbs keep the plain verb ("freuen").
- pos: one of noun, verb, adj, adv, pron, det, art, prep, conj, num, part, intj. Fix it if the candidate's main pos is wrong
  (e.g. "sondern" is a conjunction).
- display: how a learner should see it: nouns with article ("der Tisch", plural-only nouns "die Eltern"),
  verbs that are mostly reflexive with sich ("sich freuen"), everything else just the lemma.
- meanings: 1-3 short English meanings, most common first. meanings[0] is shown as a tiny gloss above the word,
  so keep it under 25 characters. Verbs start with "to" ("to eat"). No explanations in brackets unless essential.
- cefr: A1, A2 or B1 (the level at which learners usually meet the word; B1 for everything harder).
- topic: one of ${TOPICS.join(", ")}.
  basics = function words, pronouns, question words, conjunctions, common particles; actions = general verbs;
  qualities = general adjectives and adverbs; abstract = abstract nouns.
- reflexive: true only for verbs normally used with sich (sich freuen, sich setzen), otherwise false.
- example: { "de": a short natural German sentence (4-10 words) that contains the word in some form,
  "en": a natural English translation }.
  The learner reads the sentence on the day they learn the word, so use ONLY very common words: as far as possible
  words from the list of earlier words you are given, plus names (Anna, Tom, Berlin) and numbers.
  Vary the sentences; avoid starting most of them with "Das ist". Use the present tense unless the word needs another tense.
  Separable verbs may appear split ("Ich rufe dich an.") or joined. Use du-forms rather than Sie unless the word is formal.

Return JSON: {"items": [ ...one object per candidate, same order... ]}.`;

export const ENRICH_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["key", "keep", "drop_reason", "lemma", "pos", "display", "meanings", "cefr", "topic", "reflexive", "example"],
  properties: {
    key: { type: "string" },
    keep: { type: "boolean" },
    drop_reason: { type: ["string", "null"] },
    lemma: { type: "string" },
    pos: { type: "string", enum: ["noun", "verb", "adj", "adv", "pron", "det", "art", "prep", "conj", "num", "part", "intj"] },
    display: { type: "string" },
    meanings: { type: "array", items: { type: "string" } },
    cefr: { type: "string", enum: ["A1", "A2", "B1"] },
    topic: { type: "string", enum: [...TOPICS] },
    reflexive: { type: "boolean" },
    example: {
      type: "object",
      additionalProperties: false,
      required: ["de", "en"],
      properties: { de: { type: "string" }, en: { type: "string" } },
    },
  },
} as const;

export const ENRICH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: { items: { type: "array", items: ENRICH_ITEM_SCHEMA } },
} as const;

export const EXAMPLE_FIX_SYSTEM = `You write example sentences for a German word bank for complete beginners.
For each word you get the current sentence and the problems found by an automatic checker:
- "missing target": the sentence does not contain the word in any form;
- "later words": words the learner has not learned yet on that day.
Write a new short natural German sentence (4-10 words) containing the target word in some form, using only the allowed
earlier words (plus names and numbers), and a natural English translation.
Return JSON: {"items": [{"key": ..., "de": ..., "en": ...}, ...]}.`;

export const EXAMPLE_FIX_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "de", "en"],
        properties: { key: { type: "string" }, de: { type: "string" }, en: { type: "string" } },
      },
    },
  },
} as const;

export interface EnrichItem {
  key: string;
  keep: boolean;
  drop_reason: string | null;
  lemma: string;
  pos: string;
  display: string;
  meanings: string[];
  cefr: "A1" | "A2" | "B1";
  topic: string;
  reflexive: boolean;
  example: { de: string; en: string };
  /** who produced it, e.g. "openrouter:anthropic/claude-haiku-5.5" */
  source?: string;
}
