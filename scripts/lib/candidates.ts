/**
 * Step 1 of the word bank build: turn word-form frequencies (wordfreq) into
 * ranked lemma candidates using the dictionary's inflected forms
 * (gehe, ging, gegangen -> gehen).
 */
import type { DictEntry, Gender, Pos } from "../../src/lib/dict/types";
import {
  AMBIGUOUS_FORM_SHARES,
  CONTRACTIONS,
  FAMILY_FORMS,
  FUNCTION_FAMILIES,
} from "../../src/lib/german/function-words";

export interface Candidate {
  key: string;
  lemma: string;
  pos: Pos;
  otherPos: Pos[];
  /** frequency per billion words attributed to this lemma */
  score: number;
  rank: number;
  family: boolean;
  dictIds: number[];
  meanings: string[];
  gender?: Gender[];
  plural?: string[];
  genitive?: string[];
  noPlural?: boolean;
  verb?: DictEntry["verb"];
  adj?: DictEntry["adj"];
  ipa?: string;
  /** most frequent surface forms with their share of the score */
  topForms: [string, number][];
  tags?: string[];
}

const POS_PRIOR: Record<Pos, number> = {
  noun: 1,
  verb: 1,
  adj: 1,
  adv: 1,
  prep: 1,
  conj: 1,
  num: 1,
  part: 1,
  pron: 0.8,
  det: 0.8,
  art: 0.8,
  intj: 0.4,
  phrase: 0.05,
  name: 0.15,
};

function tagFactor(tags: string[] | undefined): number {
  let f = 1;
  for (const t of tags ?? []) {
    if (t === "archaic" || t === "obsolete") f *= 0.05;
    else if (t === "dialectal" || t === "regional" || t === "Austria" || t === "Switzerland") f *= 0.25;
    else if (t === "rare") f *= 0.2;
    else if (t === "colloquial" || t === "informal") f *= 0.6;
    else if (t === "vulgar" || t === "derogatory" || t === "offensive") f *= 0.3;
    else if (t === "misspelling" || t === "nonstandard") f *= 0.05;
  }
  return f;
}

interface Hit {
  entry: DictEntry;
  code: string;
}

const AUX = new Set(["sein", "haben", "werden", "können", "müssen", "sollen", "wollen", "dürfen", "mögen", "möchten"]);

export const fold = (s: string) => s.toLowerCase().replace(/ß/g, "ss");

export function buildCandidates(entries: DictEntry[], freq: Map<string, number>): Candidate[] {
  // lowercase form -> hits
  const index = new Map<string, Hit[]>();
  // wordfreq case-folds its keys (ß -> ss), so fold dictionary forms the same way
  const add = (form: string, entry: DictEntry, code: string) => {
    const k = fold(form);
    const list = index.get(k);
    if (list) {
      if (!list.some((h) => h.entry === entry)) list.push({ entry, code });
    } else index.set(k, [{ entry, code }]);
  };
  for (const e of entries) {
    add(e.w, e, "lemma");
    for (const [f, code] of e.f ?? []) {
      if (f.includes(" ")) continue; // "ruft an": particle position unknown
      add(f, e, code);
    }
  }

  // group dictionary entries by exact lemma string (case-sensitive)
  const groups = new Map<string, DictEntry[]>();
  for (const e of entries) {
    const list = groups.get(e.w);
    if (list) list.push(e);
    else groups.set(e.w, [e]);
  }

  let scoreByLemma = new Map<string, number>(); // lemma string or family key
  let formsByLemma = new Map<string, Map<string, number>>();
  let posScore = new Map<string, Map<Pos, number>>();
  const credit = (lemma: string, form: string, amount: number, pos?: Pos) => {
    scoreByLemma.set(lemma, (scoreByLemma.get(lemma) ?? 0) + amount);
    let fm = formsByLemma.get(lemma);
    if (!fm) formsByLemma.set(lemma, (fm = new Map()));
    fm.set(form, (fm.get(form) ?? 0) + amount);
    if (pos) {
      let pm = posScore.get(lemma);
      if (!pm) posScore.set(lemma, (pm = new Map()));
      pm.set(pos, (pm.get(pos) ?? 0) + amount);
    }
  };

  /**
   * Distribute every form's frequency over the lemmas it can belong to.
   * `dominant`: very common lowercase words; a capitalised noun that is spelled
   * like one of their forms (die Würde ~ würde, das Aber ~ aber) gets little weight.
   */
  const run = (dominant: Set<string> | null) => {
    scoreByLemma = new Map();
    formsByLemma = new Map();
    posScore = new Map();
    for (const [form, f] of freq) {
      // keys are case-folded by wordfreq ("strasse" for Straße)
      if (!/^[a-zäöüß]+$/.test(form)) continue;

      if (CONTRACTIONS[form]) {
        const [prep] = CONTRACTIONS[form];
        credit(prep, form, f, "prep");
        credit("der|art", form, f);
        continue;
      }

      const families = FAMILY_FORMS.get(form);
      const shares = AMBIGUOUS_FORM_SHARES[form];
      if (shares) {
        for (const [key, share] of Object.entries(shares)) {
          const [lemma, pos] = key.split("|");
          if (FUNCTION_FAMILIES.some((x) => x.key === key)) credit(key, form, f * share);
          else credit(lemma, form, f * share, pos as Pos);
        }
        continue;
      }
      if (families) {
        for (const key of families) credit(key, form, f / families.length);
        continue;
      }

      const hits = index.get(form);
      if (!hits?.length) continue;
      const isVerbInfinitive = hits.some((h) => h.entry.p === "verb" && (h.code === "lemma" || h.code === "inf"));
      // very common lowercase words this form can be: function words and auxiliary/modal verb forms
      const CLOSED_POS: Pos[] = ["conj", "prep", "det", "pron", "art", "part", "num", "adv", "intj"];
      const lowerHits = hits.filter(
        (h) =>
          dominant !== null &&
          h.entry.w[0] === h.entry.w[0].toLowerCase() &&
          h.code !== "alt" &&
          !/^(imp|k1_)/.test(h.code) &&
          dominant.has(h.entry.w),
      );
      const collidesClosed = lowerHits.some((h) => CLOSED_POS.includes(h.entry.p));
      const collidesAux = lowerHits.some((h) => h.entry.p === "verb" && AUX.has(h.entry.w));
      const weights = hits.map((h) => {
        let w = POS_PRIOR[h.entry.p] * tagFactor(h.entry.tg);
        if (h.code === "lemma") w *= 1.5;
        if (h.code === "alt") w *= 0.15;
        // short imperatives (geh, mal, schon) collide with frequent words
        if (h.code === "imp2s" || h.code === "imp2p") w *= 0.05;
        const capNoun = h.entry.p === "noun" && h.entry.w[0] !== h.entry.w[0].toLowerCase();
        if (capNoun) {
          const lemmaForm = fold(h.entry.w) === form;
          const neuter = h.entry.g?.[0] === "n";
          // nominalised infinitive (das Essen) when the verb also matches
          if (lemmaForm && isVerbInfinitive) w *= 0.35;
          // die Würde ~ würde, das Muss ~ muss: forms of auxiliary and modal verbs win
          else if (collidesAux) w *= 0.06;
          // das Aber, das Ja ~ aber, ja: nominalised function words
          else if (lemmaForm && collidesClosed && neuter) w *= 0.06;
          // (den) Wegen ~ wegen: an inflected noun form spelled like a function word
          else if (!lemmaForm && collidesClosed) w *= 0.1;
        }
        return w;
      });
      const total = weights.reduce((a, b) => a + b, 0);
      if (!total) continue;
      hits.forEach((h, i) => {
        if (!weights[i]) return;
        // show the real spelling of the form (straße, not strasse) in topForms
        const shown = fold(h.entry.w) === form ? h.entry.w.toLowerCase() : form;
        credit(h.entry.w, shown, (f * weights[i]) / total, h.entry.p);
      });
    }
  };

  run(null);
  const dominant = new Set(
    [...scoreByLemma.entries()]
      .filter(([l]) => !l.includes("|") && l[0] === l[0].toLowerCase())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 700)
      .map(([l]) => l),
  );
  run(dominant);

  const out: Candidate[] = [];
  for (const [lemmaOrKey, rawScore] of scoreByLemma) {
    const forms = [...(formsByLemma.get(lemmaOrKey) ?? new Map()).entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([form, s]) => [form, Math.round((s / rawScore) * 100) / 100] as [string, number]);
    const fam = FUNCTION_FAMILIES.find((x) => x.key === lemmaOrKey);
    if (fam) {
      out.push({
        key: fam.key,
        lemma: fam.lemma,
        pos: fam.pos,
        otherPos: [],
        score: rawScore,
        rank: 0,
        family: true,
        dictIds: [],
        meanings: fam.meanings,
        topForms: forms,
      });
      continue;
    }
    const group = groups.get(lemmaOrKey);
    if (!group) continue;
    const pm = posScore.get(lemmaOrKey) ?? new Map<Pos, number>();
    const posOrder = [...pm.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p);
    const mainPos = posOrder[0] ?? group[0].p;
    const main = group.find((e) => e.p === mainPos && !e.tg?.length) ?? group.find((e) => e.p === mainPos) ?? group[0];
    let score = rawScore;
    if (main.p === "verb" && main.verb?.sep) score *= 1.8; // finite separated forms ("ruft ... an") are not counted
    const meanings = [...main.m];
    for (const e of group) {
      if (e === main) continue;
      for (const m of e.m.slice(0, 2)) if (!meanings.includes(m)) meanings.push(`${m} [${e.p}]`);
    }
    const c: Candidate = {
      key: `${main.w}|${main.p}`,
      lemma: main.w,
      pos: main.p,
      otherPos: posOrder.filter((p) => p !== main.p),
      score,
      rank: 0,
      family: false,
      dictIds: group.map((e) => e.id),
      meanings: meanings.slice(0, 6),
      topForms: forms,
    };
    if (main.ipa) c.ipa = main.ipa;
    if (main.tg) c.tags = main.tg;
    if (main.p === "noun") {
      c.gender = main.g;
      c.plural = main.noun?.pl;
      c.genitive = main.noun?.gs;
      c.noPlural = main.noun?.noPl;
    }
    if (main.verb) c.verb = main.verb;
    if (main.adj) c.adj = main.adj;
    out.push(c);
  }

  out.sort((a, b) => b.score - a.score);
  out.forEach((c, i) => (c.rank = i + 1));
  return out;
}

/** Candidates that can never be word bank words. */
export function isJunkCandidate(c: Candidate): boolean {
  if (c.pos === "name" || c.pos === "phrase") return true;
  if (c.lemma.length < 2 && !c.family) return true;
  if (/[0-9.\s'’-]/.test(c.lemma)) return true;
  if (c.lemma.toUpperCase() === c.lemma && c.lemma.length > 1) return true; // abbreviations like "USA"
  if (c.tags?.some((t) => ["archaic", "obsolete", "misspelling", "vulgar"].includes(t))) return true;
  return false;
}
