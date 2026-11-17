/**
 * Inflection tables for the word page, built offline from the dictionary's
 * inflected forms.
 */
import type { DictEntry } from "../dict/types";
import type { Word } from "./types";

export interface Table {
  title: string;
  head?: string[];
  rows: { label: string; cells: string[] }[];
}

const first = (e: DictEntry, code: string) => e.f?.find(([, c]) => c === code)?.[0];
const all = (e: DictEntry, code: string) => [...new Set((e.f ?? []).filter(([, c]) => c === code).map(([f]) => f))];

const ART = {
  m: { n: "der", a: "den", d: "dem", g: "des" },
  f: { n: "die", a: "die", d: "der", g: "der" },
  n: { n: "das", a: "das", d: "dem", g: "des" },
  pl: { n: "die", a: "die", d: "den", g: "der" },
} as const;

export function nounTable(word: Word, e: DictEntry): Table {
  const g = word.noun?.gender ?? "m";
  const sg = g === "pl" ? null : ART[g];
  const rows = (["n", "a", "d", "g"] as const).map((c) => {
    const label = { n: "Nominative", a: "Accusative", d: "Dative", g: "Genitive" }[c];
    const sgForm = all(e, `${c}s`).join(" / ") || (c === "n" ? word.lemma : "");
    const plForm = all(e, `${c}p`).join(" / ") || (c === "n" && word.noun?.plural ? word.noun.plural : "");
    return {
      label,
      cells: [
        sg && sgForm ? `${sg[c]} ${sgForm}` : "—",
        plForm ? `${ART.pl[c]} ${plForm}` : word.noun?.plural === null ? "—" : "",
      ],
    };
  });
  return { title: "Cases", head: ["", "Singular", "Plural"], rows };
}

const PERSONS = [
  ["1s", "ich"],
  ["2s", "du"],
  ["3s", "er/sie/es"],
  ["1p", "wir"],
  ["2p", "ihr"],
  ["3p", "sie/Sie"],
] as const;

export function verbTables(word: Word, e: DictEntry): Table[] {
  const aux = word.verb?.aux ?? "haben";
  const auxForms: Record<string, string> =
    aux === "sein"
      ? { "1s": "bin", "2s": "bist", "3s": "ist", "1p": "sind", "2p": "seid", "3p": "sind" }
      : { "1s": "habe", "2s": "hast", "3s": "hat", "1p": "haben", "2p": "habt", "3p": "haben" };
  const pp = word.verb?.participle || first(e, "pp") || "";
  const refl: Record<string, string> = { "1s": "mich", "2s": "dich", "3s": "sich", "1p": "uns", "2p": "euch", "3p": "sich" };
  const withRefl = (pn: string, form: string) => {
    if (!word.verb?.reflexive || !form) return form;
    const parts = form.split(" ");
    return [parts[0], refl[pn], ...parts.slice(1)].join(" ");
  };
  const rows = PERSONS.map(([pn, pron]) => ({
    label: pron,
    cells: [
      withRefl(pn, first(e, `pr${pn}`) ?? ""),
      withRefl(pn, first(e, `pt${pn}`) ?? ""),
      pp ? withRefl(pn, `${aux === "haben/sein" ? auxForms[pn] : auxForms[pn]} ${pp}`) : "",
    ],
  }));
  const tables: Table[] = [{ title: "Conjugation", head: ["", "Present", "Präteritum", "Perfekt"], rows }];
  const imp = [first(e, "imp2s"), first(e, "imp2p")].filter(Boolean) as string[];
  const extra: { label: string; cells: string[] }[] = [];
  if (imp.length) extra.push({ label: "Imperative", cells: [imp.map((x) => `${x}!`).join("  ·  ")] });
  const k2 = first(e, "k2_3s");
  if (k2) extra.push({ label: "Konjunktiv II (er/sie/es)", cells: [k2] });
  const zu = first(e, "zu");
  if (zu) extra.push({ label: "zu-infinitive", cells: [zu] });
  if (pp) extra.push({ label: "Partizip II", cells: [`${pp} (with ${aux})`] });
  if (extra.length) tables.push({ title: "More forms", rows: extra });
  return tables;
}

export function adjTable(word: Word, e: DictEntry | null): Table {
  const cmp = word.adj?.comparative ?? (e ? first(e, "cmp") : undefined);
  const sup = word.adj?.superlative ?? (e && first(e, "sup") ? `am ${first(e, "sup")}` : undefined);
  return {
    title: "Comparison",
    rows: [
      { label: "Positive", cells: [word.lemma] },
      { label: "Comparative", cells: [cmp ?? "—"] },
      { label: "Superlative", cells: [sup ?? "—"] },
    ],
  };
}

export function familyTable(word: Word): Table | null {
  if (!word.forms) return null;
  return {
    title: "Forms",
    rows: Object.entries(word.forms).map(([form, gloss]) => ({ label: form, cells: [gloss] })),
  };
}
