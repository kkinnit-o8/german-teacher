import type { Word } from "./types";
import type { Gender, Pos } from "../dict/types";

export const POS_LABEL: Record<Pos, string> = {
  noun: "noun",
  verb: "verb",
  adj: "adjective",
  adv: "adverb",
  pron: "pronoun",
  det: "determiner",
  art: "article",
  prep: "preposition",
  conj: "conjunction",
  num: "number",
  part: "particle",
  intj: "interjection",
  phrase: "phrase",
  name: "name",
};

export function genderClass(g: Gender | undefined | null): string {
  return g ? `g-${g}` : "";
}

export function wordGender(w: Pick<Word, "noun">): Gender | undefined {
  return w.noun?.gender;
}

/** "die Tische" / "no plural" / "plural only" */
export function pluralLabel(w: Word): string {
  if (!w.noun) return "";
  if (w.noun.pluralOnly) return "plural only";
  if (!w.noun.plural) return "no plural";
  return `die ${w.noun.plural}`;
}

/** "geht · ging · ist gegangen" */
export function verbFormsLabel(w: Word): string {
  if (!w.verb) return "";
  const v = w.verb;
  const aux = v.aux === "sein" ? "ist" : v.aux === "haben/sein" ? "hat/ist" : "hat";
  return [v.present3 && `er ${v.present3}`, v.past3 && `er ${v.past3}`, v.participle && `er ${aux} ${v.participle}`]
    .filter(Boolean)
    .join(" · ");
}

/** Normalise for typed answers: ä→ae, ö→oe, ü→ue, ß→ss, lowercase, trim punctuation. */
export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[.,!?;:"'„“”»«()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
