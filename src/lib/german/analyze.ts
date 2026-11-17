/**
 * The analyzer: German text -> tokens with lemmas, glosses, separable-verb
 * groups, compound parts and gender colours.
 *
 * It is deterministic and does not depend on what the learner has learned;
 * render.ts decides what to show from the analysis plus the learned set.
 */
import type { DictEntry, Gender, Pos } from "../dict/types";
import {
  CONTRACTIONS,
  CONTRACTION_GLOSS,
  FAMILY_BY_KEY,
  FAMILY_CONTENT_HOMOGRAPHS,
  FAMILY_FORMS,
  type FunctionFamily,
} from "./function-words";
import { sentenceStarts, tokenize } from "./tokenize";
import type { AToken, Analysis, LexHit, Lexicon, WordInfo, WordLookup, WordRef } from "./types";
import { splitCompound } from "./compounds";
import { ENGLISH_WORDS } from "./english";

interface Cand {
  info: WordInfo;
  /** dictionary hit (content words) */
  hit?: LexHit;
  family?: FunctionFamily;
  gloss?: string;
  score: number;
}

interface Slot {
  tok: AToken;
  idx: number;
  lower: string;
  cap: boolean;
  start: boolean;
  cands: Cand[];
  /** all dictionary hits for the form (also the ones not chosen) */
  hits: LexHit[];
  chosen?: Cand;
}

const NOUN_LIKE: Pos[] = ["noun", "name"];
const CLOSED: Pos[] = ["conj", "prep", "det", "pron", "art", "part", "num", "adv", "intj"];
const PERSONAL = new Set(["ich", "du", "er", "sie", "es", "wir", "ihr", "man"]);
const DETERMINER_FAMILIES = new Set([
  "der|art",
  "ein|art",
  "kein|det",
  "mein|det",
  "dein|det",
  "sein|det",
  "ihr|det",
  "unser|det",
  "euer|det",
  "dieser|det",
  "jeder|det",
  "welcher|det",
  "jener|det",
  "solcher|det",
  "mancher|det",
  "alle|det",
]);
const COORD = new Set(["und", "oder", "aber", "sondern", "denn"]);
// subordinating conjunctions that start a clause (seit, bis, während, als, damit are
// left out: they are usually prepositions, comparisons or adverbs)
const SUBORD = new Set([
  "weil",
  "dass",
  "wenn",
  "ob",
  "obwohl",
  "bevor",
  "nachdem",
  "seitdem",
  "sobald",
  "falls",
  "sodass",
  "indem",
  "ehe",
]);
const SUBJECT_PRONOUNS = new Set(["ich", "du", "er", "sie", "es", "wir", "ihr", "man", "wer", "das", "dies", "jemand", "niemand"]);
const DET_OR_PRONOUN = new Set([
  ...Object.keys({ der: 1, die: 1, das: 1, den: 1, dem: 1, des: 1, ein: 1, eine: 1, einen: 1, einem: 1, einer: 1 }),
  "mein", "meine", "meinen", "dein", "deine", "deinen", "sein", "seine", "seinen", "ihr", "ihre", "ihren", "unser", "unsere",
  "mir", "dir", "mich", "dich", "uns", "euch", "ihm", "ihn", "ihnen", "sich",
  "ich", "du", "er", "sie", "es", "wir", "man", "mal", "bitte", "doch", "nicht", "jetzt", "schnell",
]);
const CLAUSE_PUNCT = /^[.,;:!?…()"„“”«»–—]$/;
/** particles that can end a clause as the second part of a separable verb */
export const SEP_PARTICLES = new Set([
  "ab",
  "an",
  "auf",
  "aus",
  "bei",
  "dabei",
  "dar",
  "durch",
  "ein",
  "empor",
  "entgegen",
  "fern",
  "fest",
  "fort",
  "her",
  "herab",
  "heran",
  "herauf",
  "heraus",
  "herbei",
  "herein",
  "herum",
  "herunter",
  "hervor",
  "hin",
  "hinab",
  "hinauf",
  "hinaus",
  "hinein",
  "hinterher",
  "hinunter",
  "hinzu",
  "kennen",
  "los",
  "mit",
  "nach",
  "nieder",
  "rein",
  "raus",
  "rüber",
  "runter",
  "statt",
  "teil",
  "um",
  "vor",
  "voran",
  "voraus",
  "vorbei",
  "vorüber",
  "weg",
  "weiter",
  "wieder",
  "zu",
  "zurecht",
  "zurück",
  "zusammen",
  "über",
  "unter",
  "spazieren",
  "statt",
  "heim",
  "hoch",
  "stehen",
  "sitzen",
  "liegen",
  "bleiben",
]);

const FINITE = /^(pr\d|pt\d|k2_|k1_|imp)/;
const PLURAL_CODE = /^[ngda]p$/;

/** Short gloss for ruby text: first meaning, first comma part, no "(refl.)". */
export function shortGlossText(m: string | undefined, cutComma = true): string {
  if (!m) return "";
  let g = m.replace(/^\(refl\.\)\s*/, "");
  g = g.split(";")[0];
  if (cutComma && g.includes(",")) {
    // cut at the first comma outside brackets: "to call, to ring" -> "to call"
    let depth = 0;
    for (let i = 0; i < g.length; i++) {
      const ch = g[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      else if (ch === "," && depth === 0) {
        g = g.slice(0, i);
        break;
      }
    }
  }
  return g.trim();
}

function infoFromEntry(e: DictEntry, words: WordLookup): WordInfo {
  const wr = wordFor(e, words);
  const info: WordInfo = {
    lemma: wr?.lemma ?? e.w,
    pos: wr?.pos ?? e.p,
    gloss: shortGlossText(wr?.gloss ?? e.m[0]),
    dict: e.id,
  };
  if (wr) info.wid = wr.id;
  const g = (wr?.gender ?? e.g?.[0]) as Gender | undefined;
  if (g && e.p === "noun") info.g = g;
  return info;
}

function infoFromWord(w: WordRef, gloss?: string): WordInfo {
  const info: WordInfo = { lemma: w.lemma, pos: w.pos, gloss: shortGlossText(gloss ?? w.gloss), wid: w.id };
  if (w.gender) info.g = w.gender;
  return info;
}

function wordFor(e: DictEntry, words: WordLookup): WordRef | undefined {
  const byDict = words.byDictId(e.id);
  if (byDict && !byDict.forms) return byDict;
  const list = words.byLemma(e.w).filter((w) => !w.forms);
  const found = list.find((w) => w.pos === e.p) ?? list[0];
  if (found) return found;
  // das Englisch, das Deutsch, das Gute: a capitalised noun made from a word bank adjective
  if (e.p === "noun" && isCapLemma(e)) {
    return words.byLemma(e.w.toLowerCase()).find((w) => w.pos === "adj" && !w.forms);
  }
  return undefined;
}

function familyInfo(fam: FunctionFamily, form: string, words: WordLookup): WordInfo {
  const w = words.byKey(fam.key);
  const gloss = fam.forms[form] ?? fam.meanings[0];
  const info: WordInfo = { lemma: fam.lemma, pos: fam.pos, gloss: shortGlossText(gloss, false) };
  if (w) info.wid = w.id;
  return info;
}

function hitScore(h: LexHit, words: WordLookup): number {
  let s = 0;
  // a lemma spelled like the form is more likely (nächste -> nächster rather than nah)
  const f = h.form.toLowerCase().split(" ")[0];
  const l = h.entry.w.toLowerCase();
  if (l.slice(0, 4) === f.slice(0, 4)) s += 0.3;
  if (wordFor(h.entry, words)) s += 4;
  if (h.code === "lemma") s += 1;
  else if (h.code === "alt") s -= 1;
  else if (/^(imp|k1_)/.test(h.code)) s -= 0.8;
  else s += 0.5;
  s += CLOSED.includes(h.entry.p) || ["noun", "verb", "adj"].includes(h.entry.p) ? 0.5 : 0.2;
  if (h.entry.p === "name") s -= 0.7;
  if (h.entry.p === "phrase") s -= 2;
  for (const t of h.entry.tg ?? []) {
    if (["archaic", "obsolete", "rare", "dialectal", "misspelling", "nonstandard"].includes(t)) s -= 1.5;
    else if (["regional", "Austria", "Switzerland"].includes(t)) s -= 0.6;
    else if (["colloquial", "informal", "slang"].includes(t)) s -= 0.2;
  }
  s += 0.05 * Math.min(h.entry.m.length, 4);
  return s;
}

const isCapLemma = (e: DictEntry) => e.w[0] !== e.w[0].toLowerCase();

function noteForCode(code: string): string | undefined {
  if (code === "pp") return "past participle";
  if (code === "zu") return "zu-infinitive";
  if (code === "prp") return "present participle";
  if (code.startsWith("pt")) return "past tense";
  if (code.startsWith("k2_")) return "subjunctive (would)";
  if (code === "cmp") return "comparative";
  if (code === "sup") return "superlative";
  if (PLURAL_CODE.test(code)) return "plural";
  return undefined;
}

export interface AnalyzeOptions {
  /** the text addresses the reader formally (Sie): helps with sentence-initial "Sie" */
  formal?: boolean;
}

export function analyze(text: string, lex: Lexicon, words: WordLookup, opts: AnalyzeOptions = {}): Analysis {
  const raw = tokenize(text);
  const starts = sentenceStarts(raw);
  const tokens: AToken[] = raw.map((r) => ({ t: r.t, k: r.k }));
  const slots: Slot[] = [];

  // formal address anywhere in the text: "Sie"/"Ihnen" capitalised mid-sentence
  let formal = Boolean(opts.formal);
  raw.forEach((r, i) => {
    if (r.k === "w" && !starts[i] && /^(Sie|Ihnen|Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihres)$/.test(r.t)) formal = true;
  });

  for (let i = 0; i < raw.length; i++) {
    if (raw[i].k !== "w") continue;
    const tok = tokens[i];
    const surface = tok.t.replace(/’/g, "'");
    const lower = surface.toLowerCase();
    const cap = surface[0] !== surface[0].toLowerCase();
    const slot: Slot = { tok, idx: i, lower, cap, start: starts[i], cands: [], hits: [] };
    slots.push(slot);

    // contractions: im = in + dem
    if (CONTRACTIONS[lower]) {
      const [prep, art] = CONTRACTIONS[lower];
      const prepHits = lex.lookup(prep).filter((h) => h.entry.p === "prep" && h.code === "lemma");
      const prepInfo = prepHits[0]
        ? infoFromEntry(prepHits[0].entry, words)
        : { lemma: prep, pos: "prep" as Pos, gloss: prep };
      const der = FAMILY_BY_KEY.get("der|art")!;
      tok.parts = [prepInfo, familyInfo(der, art, words)];
      tok.pt = "contraction";
      tok.gloss = CONTRACTION_GLOSS[lower];
      slot.chosen = { info: prepInfo, score: 10 };
      continue;
    }

    // clitic 's: geht's = geht + es
    if (/['][s]$/.test(lower) && lower.length > 2) {
      const base = surface.slice(0, -2);
      const sub = analyze(base, lex, words, opts).tokens.find((t) => t.k === "w");
      const es = familyInfo(FAMILY_BY_KEY.get("es|pron")!, "es", words);
      if (sub?.w) {
        tok.w = sub.w;
        tok.parts = [sub.w, es];
        tok.pt = "clitic";
        tok.gloss = sub.w.gloss ? `${sub.w.gloss} + it` : undefined;
        slot.chosen = { info: sub.w, score: 10 };
        continue;
      }
    }

    const form = lower.replace(/'$/, "");
    // function-word families
    const famKeys = FAMILY_FORMS.get(form) ?? [];
    for (const key of famKeys) {
      const fam = FAMILY_BY_KEY.get(key)!;
      if (fam.capitalOnly && !cap) continue;
      slot.cands.push({ info: familyInfo(fam, form, words), family: fam, score: 8 });
    }

    // dictionary
    let hits = lex.lookup(form);
    if (!hits.length && surface.endsWith("'")) hits = lex.lookup(form + "e"); // hab' -> habe
    if (famKeys.length) {
      // the family covers articles/pronouns; keep only content homographs (sein = to be, meine = I mean)
      hits = FAMILY_CONTENT_HOMOGRAPHS.has(form) ? hits.filter((h) => h.entry.p === "verb") : [];
    }
    slot.hits = hits;
    let usable = hits;
    if (!cap) {
      const lowerOnes = usable.filter((h) => !isCapLemma(h.entry));
      if (lowerOnes.length) usable = lowerOnes;
    } else if (!slot.start) {
      const capOnes = usable.filter((h) => isCapLemma(h.entry));
      if (capOnes.length) usable = capOnes;
    }
    // one candidate per entry (best code)
    const byEntry = new Map<number, LexHit>();
    for (const h of usable) {
      const prev = byEntry.get(h.entry.id);
      if (!prev || hitScore(h, words) > hitScore(prev, words)) byEntry.set(h.entry.id, h);
    }
    for (const h of byEntry.values()) {
      slot.cands.push({ info: infoFromEntry(h.entry, words), hit: h, score: hitScore(h, words) });
    }
    slot.cands.sort((a, b) => b.score - a.score);
    slot.chosen = slot.cands[0];
  }

  // ---- context rules ----
  const wordSlots = slots;
  const nextSlot = (s: Slot) => {
    const j = wordSlots.indexOf(s);
    const n = wordSlots[j + 1];
    // only if no sentence/clause punctuation in between
    if (!n) return undefined;
    for (let k = s.idx + 1; k < n.idx; k++) if (tokens[k].k === "p" && CLAUSE_PUNCT.test(tokens[k].t)) return undefined;
    return n;
  };
  const prevSlot = (s: Slot) => {
    const j = wordSlots.indexOf(s);
    const p = wordSlots[j - 1];
    if (!p) return undefined;
    for (let k = p.idx + 1; k < s.idx; k++) if (tokens[k].k === "p" && CLAUSE_PUNCT.test(tokens[k].t)) return undefined;
    return p;
  };
  const isNounish = (s: Slot | undefined) => !!s && s.cap && !s.start && s.cands.some((c) => c.hit && isCapLemma(c.hit.entry));
  const isAdjish = (s: Slot | undefined) =>
    !!s && s.cands.some((c) => c.hit && (c.hit.entry.p === "adj" || c.hit.entry.p === "num"));
  /** a noun follows, maybe after one or two adjectives */
  const nounFollows = (s: Slot) => {
    let n = nextSlot(s);
    for (let k = 0; k < 3 && n; k++) {
      if (isNounish(n)) return true;
      if (!isAdjish(n) && !/^(sehr|ganz|so|zu|neue[nmrs]?)$/.test(n.lower)) return false;
      n = nextSlot(n);
    }
    return false;
  };
  /** the candidate's entry can be a finite verb form here (any of its codes for this form) */
  const finiteCand = (s: Slot, c: Cand, re = FINITE) =>
    !!c.hit && c.hit.entry.p === "verb" && s.hits.some((h) => h.entry === c.hit!.entry && re.test(h.code));
  const pick = (s: Slot, pred: (c: Cand) => boolean) => {
    const c = s.cands.find(pred);
    if (c) s.chosen = c;
    return Boolean(c);
  };
  const verbFormSlot = (s: Slot | undefined) =>
    !!s && s.hits.some((h) => h.entry.p === "verb" && FINITE.test(h.code));
  const secondPluralVerb = (s: Slot | undefined) =>
    !!s &&
    (/^(seid|habt|könnt|wollt|müsst|sollt|dürft|mögt|wisst|wart|hattet|wart|werdet)$/.test(s.lower) ||
      s.hits.some((h) => h.entry.p === "verb" && /^(pr2p|pt2p)$/.test(h.code)));
  const thirdSingVerb = (s: Slot | undefined) =>
    !!s && s.hits.some((h) => h.entry.p === "verb" && /^(pr3s|pt3s)$/.test(h.code)) && !/en$/.test(s.lower);

  for (const s of wordSlots) {
    const fams = s.cands.filter((c) => c.family).map((c) => c.family!.key);
    // sein: possessive (sein Hund) or verb (sein, zu sein)
    if (s.lower === "sein" && fams.includes("sein|det")) {
      if (nounFollows(s)) pick(s, (c) => c.family?.key === "sein|det");
      else pick(s, (c) => c.hit?.entry.p === "verb");
    }
    // meine/meinen: possessive or the verb meinen
    if ((s.lower === "meine" || s.lower === "meinen") && fams.includes("mein|det")) {
      const prev = prevSlot(s);
      const verbish = prev && /^(ich|wir|sie|die|was|du|ihr)$/i.test(prev.lower) && !nounFollows(s);
      if (verbish) pick(s, (c) => c.hit?.entry.p === "verb");
      else pick(s, (c) => c.family?.key === "mein|det");
    }
    // ihr: you (all) / her, their / (to) her
    if (s.lower === "ihr" && fams.length) {
      const next = nextSlot(s);
      if (secondPluralVerb(next) && !isNounish(next)) pick(s, (c) => c.family?.key === "ihr|pron");
      else if (nounFollows(s)) {
        pick(s, (c) => c.family?.key === "ihr|det");
        if (s.cap && !s.start) s.chosen = { ...s.chosen!, gloss: "your (formal)" };
      } else if (s.cap && !s.start) pick(s, (c) => c.family?.key === "ihr|det");
      else pick(s, (c) => c.family?.key === "sie|pron");
    }
    if (/^ihr(e|en|em|er|es)$/.test(s.lower) && s.cap && !s.start) {
      s.chosen = { ...s.chosen!, gloss: "your (formal)" };
    }
    // sie / Sie
    if (s.lower === "sie" || s.lower === "ihnen") {
      if (!s.cap) pick(s, (c) => c.family?.key === "sie|pron");
      else if (!s.start) pick(s, (c) => c.family?.key === "Sie|pron");
      else {
        const next = nextSlot(s);
        if (s.lower === "sie" && thirdSingVerb(next)) pick(s, (c) => c.family?.key === "sie|pron");
        else if (formal) pick(s, (c) => c.family?.key === "Sie|pron");
        else pick(s, (c) => c.family?.key === "sie|pron");
      }
    }
    // der/die/das: article ("the"), relative ("who, which") or demonstrative ("that")
    if (s.chosen?.family?.key === "der|art" && /^(der|die|das|den|dem)$/.test(s.lower)) {
      if (nounFollows(s)) s.chosen = { ...s.chosen, gloss: s.lower === "dem" ? "(to) the" : "the" };
      else {
        const p = s.idx - 1 >= 0 ? tokens.slice(0, s.idx).reverse().find((t) => t.k !== "s") : undefined;
        const afterComma = p?.k === "p" && p.t === ",";
        s.chosen = { ...s.chosen, gloss: afterComma ? "who, which" : "that, this" };
      }
    }
    // sentence-initial capitalised word: noun or something else
    // (Essen ist fertig / Essen wir? / Folge mir! / Dreh den Kopf)
    if (s.start && s.cap && !s.chosen?.family) {
      const nounC = s.cands.find((c) => c.hit && isCapLemma(c.hit.entry) && c.hit.entry.p === "noun");
      const lowerC = s.cands.filter((c) => c.hit && !isCapLemma(c.hit.entry));
      if (nounC && lowerC.length) {
        const verbC = lowerC.filter((c) => finiteCand(s, c) && c.info.wid).sort((a, b) => b.score - a.score)[0];
        const closed = lowerC.find((c) => CLOSED.includes(c.hit!.entry.p) || c.hit!.entry.p === "adj");
        const next = nextSlot(s);
        if (verbC && next && DET_OR_PRONOUN.has(next.lower)) s.chosen = verbC;
        else if (closed) s.chosen = closed;
        else s.chosen = nounC;
      }
    }
    // a finite verb right after its subject: "ich weiß", "ich liebe dich", "das stimmt", "wer bestimmt"
    {
      const prev = prevSlot(s);
      // only verbs from the word bank: "du heute" is not the past tense of heuen
      const verbC = s.cands
        .filter((c) => finiteCand(s, c, /^(pr\d|pt\d|k2_)/) && c.info.wid)
        .sort((a, b) => b.score - a.score)[0];
      if (verbC && prev && SUBJECT_PRONOUNS.has(prev.lower) && s.chosen?.hit?.entry.p !== "verb" && !s.chosen?.family) {
        const prevIsArticle = prev.lower === "das" && nounFollows(prev);
        if (!prevIsArticle && !(s.cap && !s.start)) s.chosen = verbC;
      }
    }
    // perfect tense with haben/werden: "hat mich verletzt" is the participle of verletzen
    if (s.chosen?.hit && s.chosen.hit.entry.p !== "verb") {
      const ppC = s.cands.find((c) => finiteCand(s, c, /^pp$/) && c.info.wid);
      if (ppC) {
        const clauseHasAux = wordSlots.some(
          (o) =>
            o.idx < s.idx &&
            o.idx > s.idx - 30 &&
            o.hits.some((h) => (h.entry.w === "haben" || h.entry.w === "werden") && FINITE.test(h.code)),
        );
        if (clauseHasAux) s.chosen = ppC;
      }
    }
    // "am" before a superlative: am besten = "(the) best"
    if (s.lower === "am") {
      const next = nextSlot(s);
      if (next?.hits.some((h) => h.code === "sup")) s.tok.gloss = "(the) most";
    }
  }

  // ---- separable verbs: "Ich rufe dich morgen an" ----
  let grp = 0;
  const clauses: Slot[][] = [];
  let cur: Slot[] = [];
  let lastIdx = -1;
  for (const s of wordSlots) {
    let boundary = false;
    for (let k = lastIdx + 1; k < s.idx; k++) if (tokens[k].k === "p" && CLAUSE_PUNCT.test(tokens[k].t)) boundary = true;
    if (boundary || COORD.has(s.lower) || SUBORD.has(s.lower)) {
      if (cur.length) clauses.push(cur);
      cur = [];
    }
    if (!COORD.has(s.lower)) cur.push(s);
    lastIdx = s.idx;
  }
  if (cur.length) clauses.push(cur);

  for (const clause of clauses) {
    if (clause.length < 2) continue;
    const last = clause[clause.length - 1];
    if (!SEP_PARTICLES.has(last.lower) || last.tok.parts) continue;
    // subordinate clauses keep the verb joined ("weil ich dich anrufe")
    if (SUBORD.has(clause[0].lower)) continue;
    for (const v of clause.slice(0, -1)) {
      if (v.cap && !v.start) continue; // a capitalised word mid-sentence is a noun (der Laden ... zu)
      const chosenEntry = v.chosen?.hit?.entry;
      const verbHits = v.hits
        .filter((h) => h.entry.p === "verb" && FINITE.test(h.code))
        .sort(
          (a, b) =>
            Number(b.entry === chosenEntry) - Number(a.entry === chosenEntry) || hitScore(b, words) - hitScore(a, words),
        );
      let joined: DictEntry | undefined;
      for (const vh of verbHits) {
        const compound = last.lower + vh.entry.w;
        const cand = lex
          .lookup(compound)
          .find((h) => h.entry.p === "verb" && h.code === "lemma" && h.entry.verb?.sep === last.lower);
        if (cand) {
          joined = cand.entry;
          break;
        }
      }
      if (!joined) continue;
      grp++;
      const info = infoFromEntry(joined, words);
      v.chosen = { info, score: 20 };
      last.chosen = { info, score: 20 };
      for (const s of [v, last]) {
        s.tok.grp = grp;
        s.tok.pt = "separable";
      }
      v.tok.role = "verb";
      last.tok.role = "particle";
      if (!info.wid) {
        // not in the word bank: known if particle and base verb are known
        const baseHit = verbHits.find((h) => last.lower + h.entry.w === joined!.w);
        const baseInfo = baseHit ? infoFromEntry(baseHit.entry, words) : undefined;
        const partHits = lex.lookup(last.lower).filter((h) => !isCapLemma(h.entry));
        const partInfo = partHits[0] ? infoFromEntry(partHits.sort((a, b) => hitScore(b, words) - hitScore(a, words))[0].entry, words) : undefined;
        if (baseInfo && partInfo) v.tok.parts = last.tok.parts = [partInfo, baseInfo];
      }
      break;
    }
  }

  // ---- write results, names, compounds ----
  for (const s of wordSlots) {
    const tok = s.tok;
    if (tok.pt === "contraction" || tok.pt === "clitic") continue;
    const c = s.chosen;
    if (c) {
      tok.w = c.info;
      if (c.gloss) tok.gloss = c.gloss;
      if (c.hit) {
        const note = noteForCode(c.hit.code);
        if (note && tok.pt !== "separable") tok.note = note;
      }
    }
    const isName = c?.hit?.entry.p === "name" && !(s.cands.some((x) => x.hit && x.hit.entry.p !== "name"));
    if (isName) {
      tok.name = true;
      delete tok.w;
      continue;
    }
    if (!tok.w || !tok.w.wid) {
      // compound made of known words? (Kinderzimmer = Kinder + Zimmer)
      const split = splitCompound(tok.t, words);
      if (split && split.length > 1) {
        tok.parts = split.map((p) => infoFromWord(p));
        tok.pt = "compound";
        if (!tok.w) {
          const lastPart = split[split.length - 1];
          tok.w = {
            lemma: tok.t,
            pos: lastPart.pos,
            gloss: split.map((p) => shortGlossText(p.gloss)).join(" + "),
          };
          if (lastPart.gender) tok.w.g = lastPart.gender;
        }
        continue;
      }
    }
    if (!tok.w) {
      if (ENGLISH_WORDS.has(s.lower)) tok.foreign = true;
      else if (s.cap) tok.name = true;
      else tok.unknown = true;
    }
  }

  // ---- gender colours: nouns, and the articles that agree with them ----
  for (let j = 0; j < wordSlots.length; j++) {
    const s = wordSlots[j];
    const w = s.tok.w;
    if (!w || w.pos !== "noun" || !w.g) continue;
    const plural = s.chosen?.hit ? PLURAL_CODE.test(s.chosen.hit.code) && !s.chosen.hit.entry.g?.includes("pl") && w.g !== "pl" : false;
    // forms like "Kinder" are plural; forms like "Tisch" are not
    const gc: Gender = w.g === "pl" ? "pl" : plural && !isSingularToo(s, lex) ? "pl" : w.g;
    s.tok.gc = gc;
    // look back over adjectives for the article/determiner
    for (let k = j - 1, steps = 0; k >= 0 && steps < 4; k--, steps++) {
      const p = wordSlots[k];
      if (p.idx < s.idx - 12) break;
      const fam = p.chosen?.family?.key;
      if ((fam && DETERMINER_FAMILIES.has(fam)) || (p.tok.pt === "contraction" && /m$|r$/.test(p.lower))) {
        p.tok.gc = gc;
        break;
      }
      const pw = p.tok.w;
      if (!pw || !(pw.pos === "adj" || pw.pos === "num" || pw.pos === "adv")) break;
    }
  }

  return { text, tokens };
}

/** "Tische" is plural only; "Lehrer" can be singular too (der Lehrer / die Lehrer). */
function isSingularToo(s: Slot, lex: Lexicon): boolean {
  const e = s.chosen?.hit?.entry;
  if (!e) return false;
  return lex.lookup(s.lower).some((h) => h.entry.id === e.id && /^[ngda]s$|^lemma$/.test(h.code));
}
