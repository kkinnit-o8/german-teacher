/**
 * Turns one wiktextract/kaikki.org JSON entry (German section of English
 * Wiktionary) into the compact DictEntry format, or into "form-of" links.
 */
import type { AdjInfo, DictEntry, Gender, NounInfo, Pos, VerbInfo } from "../../src/lib/dict/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = any;

const POS_MAP: Record<string, Pos> = {
  noun: "noun",
  verb: "verb",
  adj: "adj",
  adv: "adv",
  pron: "pron",
  det: "det",
  article: "art",
  prep: "prep",
  postp: "prep",
  conj: "conj",
  num: "num",
  particle: "part",
  intj: "intj",
  phrase: "phrase",
  prep_phrase: "phrase",
  name: "name",
};

export function mapPos(p: string): Pos | null {
  return POS_MAP[p] ?? null;
}

const BAD_SENSE_TAGS = new Set([
  "obsolete",
  "archaic",
  "dialectal",
  "misspelling",
  "nonstandard",
  "historical",
  "rare",
]);
const USAGE_TAGS = new Set([
  "colloquial",
  "informal",
  "regional",
  "dated",
  "archaic",
  "obsolete",
  "slang",
  "vulgar",
  "derogatory",
  "offensive",
  "rare",
  "Austria",
  "Switzerland",
  "dialectal",
  "nonstandard",
  "misspelling",
]);
const SKIP_FORM_TAGS_EXTRA = ["pronunciation-spelling", "eye-dialect", "Early", "Middle"];
const SKIP_FORM_TAGS = new Set([
  "table-tags",
  "inflection-template",
  "class",
  "auxiliary",
  "romanization",
  "error-unrecognized-form",
  "includes-article",
  "obsolete",
  "archaic",
  "diminutive",
  "augmentative",
  "multiword-construction",
  "dialectal",
  "nonstandard",
  "misspelling",
]);

/** Strip parentheses/brackets and reduce a Wiktionary gloss to a short meaning. */
export function shortGloss(gloss: string): string {
  let g = gloss;
  // remove nested parentheses and brackets
  for (let i = 0; i < 4; i++) g = g.replace(/\([^()]*\)/g, "").replace(/\[[^[\]]*\]/g, "");
  g = g.replace(/“|”|"/g, "").replace(/\s+/g, " ").trim();
  g = g.split(/;|:/)[0].trim();
  g = g.replace(/[.,;:\s]+$/, "").replace(/^[,;:\s]+/, "");
  if (g.length > 40) {
    const firstComma = g.split(",")[0].trim();
    if (firstComma.length >= 2) g = firstComma;
  }
  return g;
}

function senseIsFormOf(s: Raw): boolean {
  const tags: string[] = s.tags ?? [];
  return Boolean(s.form_of || s.alt_of) || tags.includes("form-of") || tags.includes("alt-of");
}

export interface FormOfLink {
  form: string;
  pos: Pos;
  target: string;
  code: string;
}

function personNumber(tags: string[]): string | null {
  const person = tags.includes("first-person")
    ? "1"
    : tags.includes("second-person")
      ? "2"
      : tags.includes("third-person")
        ? "3"
        : null;
  const number = tags.includes("plural") ? "p" : tags.includes("singular") ? "s" : null;
  if (!person || !number) return null;
  return person + number;
}

/** Map wiktextract form tags to a compact form code; null = ignore the form. */
export function formCode(pos: Pos, tags: string[]): string | null {
  if (tags.some((t) => SKIP_FORM_TAGS.has(t) || SKIP_FORM_TAGS_EXTRA.includes(t))) return null;
  if (tags.includes("alternative")) return "alt";
  if (pos === "noun" || pos === "name") {
    const cases = ["nominative", "genitive", "dative", "accusative"];
    const c = cases.find((x) => tags.includes(x));
    const num = tags.includes("plural") ? "p" : "s";
    if (c) return c[0] + num;
    if (tags.length === 1 && tags[0] === "plural") return "np";
    if (tags.includes("plural")) return "np";
    if (tags.includes("singular")) return "ns";
    return null;
  }
  if (pos === "verb") {
    if (tags.includes("infinitive-zu")) return "zu";
    if (tags.includes("infinitive")) return "inf";
    if (tags.includes("participle")) return tags.includes("present") ? "prp" : "pp";
    if (tags.includes("imperative")) return tags.includes("plural") ? "imp2p" : "imp2s";
    const pn = personNumber(tags) ?? (tags.includes("past") || tags.includes("present") ? "3s" : null);
    if (!pn) return null;
    if (tags.includes("subjunctive-ii") || (tags.includes("subjunctive") && tags.includes("past")))
      return "k2_" + pn;
    if (tags.includes("subjunctive-i") || tags.includes("subjunctive")) return "k1_" + pn;
    if (tags.includes("preterite") || tags.includes("past")) return "pt" + pn;
    if (tags.includes("present")) return "pr" + pn;
    return null;
  }
  if (pos === "adj" || pos === "adv") {
    if (tags.includes("comparative")) return "cmp";
    if (tags.includes("superlative")) return "sup";
    return "dec";
  }
  // pronouns, determiners, articles, numerals: keep declined forms
  return "dec";
}

function parseGender(raw: Raw, senses: Raw[]): Gender[] | undefined {
  const exp: string = raw.head_templates?.[0]?.expansion ?? "";
  const word: string = raw.word;
  const rest = exp.startsWith(word) ? exp.slice(word.length).trim() : "";
  const m = rest.match(/^((?:m|f|n|pl)(?: or (?:m|f|n))*)(?:\s|$|\()/);
  if (m) {
    const gs = m[1].split(" or ").filter((x) => ["m", "f", "n", "pl"].includes(x)) as Gender[];
    if (gs.length) return gs;
  }
  const tagSet = new Set<string>();
  for (const s of senses) for (const t of s.tags ?? []) tagSet.add(t);
  if (tagSet.has("plural-only")) return ["pl"];
  const out: Gender[] = [];
  if (tagSet.has("masculine")) out.push("m");
  if (tagSet.has("feminine")) out.push("f");
  if (tagSet.has("neuter")) out.push("n");
  return out.length ? out : undefined;
}

function pickIpa(raw: Raw): string | undefined {
  const sounds: Raw[] = (raw.sounds ?? []).filter((s: Raw) => s.ipa);
  if (!sounds.length) return undefined;
  const bad = (s: Raw) =>
    (s.tags ?? []).some((t: string) =>
      ["archaic", "obsolete", "Austria", "Switzerland", "Bavaria", "dialectal", "colloquial"].includes(t),
    );
  const best = sounds.find((s) => !bad(s) && !s.note) ?? sounds.find((s) => !bad(s)) ?? sounds[0];
  return String(best.ipa).replace(/^[/[]|[/\]]$/g, "").trim();
}

function uniq<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

export type ParseResult =
  | { kind: "entry"; entry: Omit<DictEntry, "id"> }
  | { kind: "formof"; links: FormOfLink[] }
  | { kind: "skip" };

export function parseKaikki(raw: Raw): ParseResult {
  if (raw.lang_code && raw.lang_code !== "de") return { kind: "skip" };
  const pos = mapPos(raw.pos);
  const word: string = raw.word;
  if (!pos || !word || /\s{2,}/.test(word) || word.length > 40) return { kind: "skip" };
  const senses: Raw[] = (raw.senses ?? []).filter((s: Raw) => (s.glosses ?? []).length || s.form_of);
  if (!senses.length) return { kind: "skip" };

  const lemmaSenses = senses.filter((s) => !senseIsFormOf(s));
  if (!lemmaSenses.length) {
    // pure form-of / alt-of entry, e.g. "ging" -> gehen
    const links: FormOfLink[] = [];
    for (const s of senses) {
      const tags: string[] = s.tags ?? [];
      if (
        tags.some((t) =>
          ["obsolete", "archaic", "misspelling", "dialectal", "diminutive", "augmentative", "pronunciation-spelling"].includes(t),
        )
      )
        continue;
      const targets: Raw[] = s.form_of ?? s.alt_of ?? [];
      for (const t of targets) {
        if (!t?.word || /\s/.test(t.word)) continue;
        const code = s.alt_of || tags.includes("alt-of") ? "alt" : (formCode(pos, tags) ?? "alt");
        links.push({ form: word, pos, target: t.word, code });
      }
    }
    return links.length ? { kind: "formof", links } : { kind: "skip" };
  }

  // meanings
  const good = lemmaSenses.filter((s) => !(s.tags ?? []).some((t: string) => BAD_SENSE_TAGS.has(t)));
  const useSenses = good.length ? good : lemmaSenses;
  const meanings: string[] = [];
  for (const s of useSenses) {
    const gl: string[] = s.glosses ?? [];
    let g = gl[0] ?? "";
    // "As a copulative verb" / "Used to ..." are headers; the real meaning follows
    if (gl.length > 1 && /^(As an? |Used |Forms |In the sense )/i.test(g)) g = gl[1];
    let short = shortGloss(g);
    if (!short && gl[1]) short = shortGloss(gl[1]);
    if (!short) continue;
    if (pos === "verb" && (s.tags ?? []).includes("reflexive") && !short.startsWith("(refl")) {
      short = "(refl.) " + short;
    }
    if (!meanings.some((x) => x.toLowerCase() === short.toLowerCase())) meanings.push(short);
    if (meanings.length >= 5) break;
  }
  if (!meanings.length) return { kind: "skip" };
  // grammatical descriptions ("forms the perfect aspect", "Used to indicate dates") go last
  const isDescription = (x: string) => /^(forms |used |as an? |indicates )/i.test(x);
  if (meanings.some((x) => !isDescription(x))) {
    meanings.sort((a, b) => Number(isDescription(a)) - Number(isDescription(b)));
  }

  // usage tags shared by all senses
  let common: string[] | null = null;
  for (const s of lemmaSenses) {
    const t: string[] = (s.tags ?? []).filter((x: string) => USAGE_TAGS.has(x));
    common = common === null ? t : common.filter((x) => t.includes(x));
  }
  const tg = common && common.length ? [...new Set(common)] : undefined;

  // forms
  const forms: [string, string][] = [];
  const seen = new Set<string>();
  for (const f of raw.forms ?? []) {
    const form: string = f.form;
    const tags: string[] = f.tags ?? [];
    if (!form || form === "-" || form.startsWith("-") || form.length > 40) continue;
    if (/^(no-table-tags|de-\w+)$/.test(form)) continue;
    const code = formCode(pos, tags);
    if (!code) continue;
    if (code === "alt") {
      // drop junk like "frühneuhochdeutsch" or author names and non-German letters
      if (/\s/.test(form) || /[^A-Za-zÄÖÜäöüß'-]/.test(form)) continue;
      if (pos === "noun" && form[0] !== form[0].toUpperCase()) continue;
      const fold = (x: string) => x.toLowerCase().replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u");
      if (fold(form)[0] !== fold(word)[0] && Math.abs(form.length - word.length) > 2) continue;
      if (pos !== "noun" && pos !== "name" && form[0] !== form[0].toLowerCase() && word[0] === word[0].toLowerCase())
        continue;
    }
    let ff = form;
    if (pos === "adj" || pos === "adv") {
      // "am besten" -> "besten"
      if (ff.startsWith("am ")) ff = ff.slice(3);
      if (/\s/.test(ff)) continue;
    } else if (pos !== "verb" && /\s/.test(ff)) continue;
    const key = ff + "|" + code;
    if (seen.has(key)) continue;
    seen.add(key);
    forms.push([ff, code]);
  }

  const entry: Omit<DictEntry, "id"> = { w: word, p: pos, m: meanings };
  const ipa = pickIpa(raw);
  if (ipa) entry.ipa = ipa;
  if (tg) entry.tg = tg;

  const exp: string = raw.head_templates?.[0]?.expansion ?? "";
  if (pos === "noun") {
    entry.g = parseGender(raw, lemmaSenses);
    const noun: NounInfo = {};
    const gs = uniq(forms.filter(([, c]) => c === "gs").map(([f]) => f));
    const pl = uniq(forms.filter(([, c]) => c === "np").map(([f]) => f));
    if (gs.length) noun.gs = gs;
    if (pl.length) noun.pl = pl;
    if (/no plural|uncountable/.test(exp) && !pl.length) noun.noPl = true;
    if (Object.keys(noun).length) entry.noun = noun;
  } else if (pos === "verb") {
    const verb: VerbInfo = {};
    const auxes = (raw.forms ?? [])
      .filter((f: Raw) => (f.tags ?? []).includes("auxiliary"))
      .map((f: Raw) => f.form)
      .filter((x: string) => x === "haben" || x === "sein");
    if (auxes.length) verb.aux = uniq(auxes) as ("haben" | "sein")[];
    // head-form values are first in the list
    const first = (code: string) => forms.find(([, c]) => c === code)?.[0];
    verb.p3 = first("pr3s");
    verb.pt = first("pt3s");
    verb.pp = first("pp");
    const arg: string = raw.head_templates?.[0]?.args?.["1"] ?? "";
    const stem = arg.split("<")[0];
    if (stem.includes(".") && !stem.startsWith(".")) {
      verb.sep = stem.split(".")[0];
    } else if (verb.p3 && verb.p3.includes(" ")) {
      verb.sep = verb.p3.split(" ").pop();
    }
    if (verb.sep && !word.startsWith(verb.sep)) delete verb.sep;
    const firstSenseTags: string[] = useSenses[0]?.tags ?? [];
    if (firstSenseTags.includes("reflexive")) verb.refl = true;
    if (/\b(strong|irregular|mixed|preterite-present)\b/.test(exp)) verb.irr = true;
    for (const k of Object.keys(verb) as (keyof VerbInfo)[]) if (verb[k] === undefined) delete verb[k];
    entry.verb = verb;
  } else if (pos === "adj") {
    const adj: AdjInfo = {};
    // head forms: "comparative besser, superlative am besten"
    const cm = exp.match(/comparative ([^,)]+)/);
    const sm = exp.match(/superlative (?:am )?([^,)]+)/);
    if (cm) adj.cmp = cm[1].split(" or ").map((x) => x.trim());
    if (sm) adj.sup = sm[1].split(" or ").map((x) => x.replace(/^am /, "").trim());
    if (Object.keys(adj).length) entry.adj = adj;
  }
  if (forms.length) entry.f = forms;
  return { kind: "entry", entry };
}
