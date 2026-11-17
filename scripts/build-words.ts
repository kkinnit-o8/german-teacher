/**
 * npm run build:words  [-- --step candidates|enrich|examples|assemble] [--limit 2700] [--max-words 2400]
 *
 * Builds the word bank data/words.json. Resumable: every LLM result is cached
 * in data/build/enrich/*.jsonl, so an interrupted run continues where it stopped.
 *
 *  1. candidates  word-form frequencies (wordfreq) -> lemmas via the dictionary's
 *                 inflected forms -> data/build/candidates.json
 *  2. enrich      LLM review (keep/drop, meanings, CEFR level, topic, example
 *                 sentence) through OpenRouter, in batches -> data/build/enrich/
 *  3. examples    validate the example sentences with the app's own lemmatizer
 *                 (target word present, words ranked later), regenerate
 *                 failures up to 3 times, keep the best attempt and flag it
 *  4. assemble    merge everything with grammar data from the dictionary
 *                 -> data/words.json (stable word ids in data/build/ids.json)
 *
 * Steps 2 and 3 need OPENROUTER_API_KEY (in .env.local). Without it they are
 * skipped and the word bank is assembled from the cached results.
 */
import fs from "node:fs";
import path from "node:path";
import { readDictGz } from "../src/lib/dict/read";
import type { DictEntry, Pos } from "../src/lib/dict/types";
import { FAMILY_BY_KEY } from "../src/lib/german/function-words";
import type { Cefr, NounGender, Topic, Word, WordBank } from "../src/lib/words/types";
import { TOPICS } from "../src/lib/words/types";
import { complete, extractJson, getApiKey } from "../src/lib/openrouter";
import { buildCandidates, isJunkCandidate, type Candidate } from "./lib/candidates";
import { ENRICH_SCHEMA, ENRICH_SYSTEM, type EnrichItem } from "./lib/enrich-prompt";
import { loadWordfreq } from "./lib/wordfreq";
import { loadEnvLocal } from "./lib/env";

const ROOT = path.resolve(__dirname, "..");
const BUILD = path.join(ROOT, "data", "build");
const ENRICH_DIR = path.join(BUILD, "enrich");
const CANDIDATES_FILE = path.join(BUILD, "candidates.json");
const IDS_FILE = path.join(BUILD, "ids.json");
const OVERRIDES_FILE = path.join(BUILD, "overrides.json");
const EXAMPLES_REPORT = path.join(BUILD, "examples-report.json");
const WORDS_FILE = path.join(ROOT, "data", "words.json");

const args = process.argv.slice(2);
const argVal = (name: string, def: string) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const STEP = argVal("--step", "all");
const LIMIT = Number(argVal("--limit", "2700"));
const MAX_WORDS = Number(argVal("--max-words", "2400"));
const MODEL = argVal("--model", process.env.WORDS_MODEL ?? "anthropic/claude-haiku-5.5");
const BATCH = 25;

export interface CompactCandidate {
  key: string;
  rank: number;
  lemma: string;
  pos: Pos;
  otherPos: Pos[];
  family: boolean;
  meanings: string[];
  gender?: string[];
  plural?: string[];
  verb?: string;
  adj?: string;
  forms: string;
  score: number;
  share: number;
  dictIds: number[];
}

function compact(c: Candidate, totalFreq: number): CompactCandidate {
  const out: CompactCandidate = {
    key: c.key,
    rank: c.rank,
    lemma: c.lemma,
    pos: c.pos,
    otherPos: c.otherPos,
    family: c.family,
    meanings: c.meanings,
    forms: c.topForms.map(([f, s]) => `${f} ${s}`).join(", "),
    score: Math.round(c.score),
    share: c.score / totalFreq,
    dictIds: c.dictIds,
  };
  if (c.gender) out.gender = c.gender;
  if (c.plural) out.plural = c.plural;
  if (c.verb) out.verb = [c.verb.p3, c.verb.pt, c.verb.pp, c.verb.aux?.join("/")].filter(Boolean).join(", ");
  if (c.adj) out.adj = [c.adj.cmp?.[0], c.adj.sup?.[0]].filter(Boolean).join(", ");
  return out;
}

function stepCandidates(): CompactCandidate[] {
  console.log("Step 1: candidates");
  const { entries } = readDictGz();
  const freq = loadWordfreq();
  let total = 0;
  for (const [w, f] of freq) if (/^[a-zäöüß]+$/.test(w)) total += f;
  const all = buildCandidates(entries, freq).filter((c) => !isJunkCandidate(c));
  all.forEach((c, i) => (c.rank = i + 1));
  const list = all.slice(0, Math.max(LIMIT, 3000)).map((c) => compact(c, total));
  fs.mkdirSync(BUILD, { recursive: true });
  fs.writeFileSync(CANDIDATES_FILE, "[\n" + list.map((c) => JSON.stringify(c)).join(",\n") + "\n]\n");
  console.log(`  wrote ${list.length} candidates to ${path.relative(ROOT, CANDIDATES_FILE)}`);
  return list;
}

function readCandidates(): CompactCandidate[] {
  if (!fs.existsSync(CANDIDATES_FILE)) return stepCandidates();
  return JSON.parse(fs.readFileSync(CANDIDATES_FILE, "utf8"));
}

export function readEnrichCache(): Map<string, EnrichItem> {
  const map = new Map<string, EnrichItem>();
  if (!fs.existsSync(ENRICH_DIR)) return map;
  const files = fs.readdirSync(ENRICH_DIR).filter((f) => f.endsWith(".jsonl")).sort();
  for (const f of files) {
    for (const line of fs.readFileSync(path.join(ENRICH_DIR, f), "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const item = JSON.parse(line) as EnrichItem;
        if (item.key) map.set(item.key, item);
      } catch {
        console.warn(`  bad line in ${f}: ${line.slice(0, 80)}`);
      }
    }
  }
  return map;
}

function validItem(x: unknown): x is EnrichItem {
  const i = x as EnrichItem;
  return (
    !!i &&
    typeof i.key === "string" &&
    typeof i.keep === "boolean" &&
    typeof i.lemma === "string" &&
    Array.isArray(i.meanings) &&
    ["A1", "A2", "B1"].includes(i.cefr) &&
    !!i.example &&
    typeof i.example.de === "string"
  );
}

/** the allowed earlier words for a batch, as a compact list */
function earlierWords(cands: CompactCandidate[], uptoRank: number): string {
  return cands
    .filter((c) => c.rank < uptoRank)
    .map((c) => c.lemma)
    .join(", ");
}

async function stepEnrich(cands: CompactCandidate[]) {
  console.log("Step 2: enrich (LLM review, meanings, CEFR, topic, example sentences)");
  const cache = readEnrichCache();
  const todo = cands.filter((c) => c.rank <= LIMIT && !cache.has(c.key));
  console.log(`  ${cache.size} cached, ${todo.length} to do`);
  if (!todo.length) return;
  if (!getApiKey()) {
    console.log("  No OPENROUTER_API_KEY found: skipping. Put your key in .env.local and run npm run build:words again.");
    return;
  }
  fs.mkdirSync(ENRICH_DIR, { recursive: true });
  const outFile = path.join(ENRICH_DIR, "openrouter.jsonl");
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const user =
      `Earlier words (the learner knows these when they learn the candidates below):\n${earlierWords(cands, batch[0].rank)}\n\n` +
      `Candidates (rank = frequency rank):\n` +
      batch
        .map((c) =>
          JSON.stringify({
            key: c.key,
            rank: c.rank,
            lemma: c.lemma,
            pos: c.pos,
            otherPos: c.otherPos,
            dictionary_meanings: c.meanings,
            gender: c.gender,
            plural: c.plural,
            verb: c.verb,
            frequent_forms: c.forms,
          }),
        )
        .join("\n");
    let items: EnrichItem[] | null = null;
    for (let attempt = 1; attempt <= 3 && !items; attempt++) {
      try {
        const res = await complete({
          model: MODEL,
          messages: [
            { role: "system", content: ENRICH_SYSTEM },
            { role: "user", content: user },
          ],
          schema: { name: "word_bank_batch", schema: ENRICH_SCHEMA as unknown as Record<string, unknown> },
          maxTokens: 9000,
          temperature: 0.4,
        });
        const parsed = extractJson(res.text) as { items?: unknown[] } | undefined;
        const ok = (parsed?.items ?? []).filter(validItem);
        if (ok.length >= batch.length * 0.8) items = ok;
        else console.warn(`  batch ${i / BATCH + 1}: only ${ok.length}/${batch.length} valid items, retrying`);
      } catch (e) {
        console.warn(`  batch ${i / BATCH + 1} attempt ${attempt} failed: ${(e as Error).message}`);
        if ((e as { kind?: string }).kind === "auth") throw e;
      }
    }
    if (!items) {
      console.warn(`  giving up on batch starting at rank ${batch[0].rank}; run again later`);
      continue;
    }
    const keys = new Set(batch.map((c) => c.key));
    const lines = items
      .filter((it) => keys.has(it.key))
      .map((it) => JSON.stringify({ ...it, source: `openrouter:${MODEL}` }))
      .join("\n");
    fs.appendFileSync(outFile, lines + "\n");
    console.log(`  ranks ${batch[0].rank}-${batch[batch.length - 1].rank}: ${items.length} items`);
  }
}

interface Overrides {
  drop?: string[];
  items?: Record<string, Partial<EnrichItem>>;
}

function readOverrides(): Overrides {
  if (!fs.existsSync(OVERRIDES_FILE)) return {};
  return JSON.parse(fs.readFileSync(OVERRIDES_FILE, "utf8"));
}

function articleOf(g: NounGender): "der" | "die" | "das" {
  return g === "m" ? "der" : g === "n" ? "das" : "die";
}

export function stepAssemble(cands: CompactCandidate[]) {
  console.log("Step 4: assemble data/words.json");
  const { entries } = readDictGz();
  const byId = new Map(entries.map((e) => [e.id, e]));
  const byLemma = new Map<string, DictEntry[]>();
  for (const e of entries) {
    const l = byLemma.get(e.w) ?? [];
    l.push(e);
    byLemma.set(e.w, l);
  }
  const cache = readEnrichCache();
  const overrides = readOverrides();
  const dropSet = new Set(overrides.drop ?? []);
  const ids: Record<string, number> = fs.existsSync(IDS_FILE) ? JSON.parse(fs.readFileSync(IDS_FILE, "utf8")) : {};
  let nextId = Math.max(0, ...Object.values(ids)) + 1;
  const report: Record<string, { flagged?: boolean; later?: string[]; de?: string; en?: string }> = fs.existsSync(
    EXAMPLES_REPORT,
  )
    ? JSON.parse(fs.readFileSync(EXAMPLES_REPORT, "utf8")).items ?? {}
    : {};

  const words: Word[] = [];
  const seen = new Set<string>();
  for (const c of cands) {
    if (words.length >= MAX_WORDS) break;
    let item = cache.get(c.key);
    if (!item) continue;
    if (overrides.items?.[c.key]) item = { ...item, ...overrides.items[c.key] } as EnrichItem;
    if (!item.keep || dropSet.has(c.key)) continue;
    const pos = item.pos as Pos;
    const lemma = item.lemma.trim();
    const fam = c.family ? FAMILY_BY_KEY.get(c.key) : undefined;
    const key = fam ? fam.key : `${lemma}|${pos}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const group = byLemma.get(lemma) ?? c.dictIds.map((id) => byId.get(id)!).filter(Boolean);
    const main = group.find((e) => e.p === pos) ?? group[0];
    const topic = (TOPICS as readonly string[]).includes(item.topic) ? (item.topic as Topic) : "abstract";
    const ex = report[key] ?? report[c.key];
    const w: Word = {
      id: (ids[key] ??= nextId++),
      key,
      lemma,
      display: fam ? fam.display : item.display.trim() || lemma,
      pos,
      meanings: (fam ? item.meanings.length ? item.meanings : fam.meanings : item.meanings).map((m) => m.trim()).filter(Boolean),
      cefr: item.cefr as Cefr,
      rank: words.length + 1,
      topic,
      share: c.share,
    };
    if (main?.ipa) w.ipa = main.ipa;
    const exDe = ex?.de ?? item.example.de;
    const exEn = ex?.en ?? item.example.en;
    w.example = { de: exDe.trim(), en: exEn.trim() };
    if (ex?.flagged) w.example.flagged = true;
    if (ex?.later?.length) w.example.later = ex.later;
    if (fam) w.forms = fam.forms;
    w.dictIds = group.map((e) => e.id);

    if (pos === "noun" && main) {
      // the article in the reviewed display wins if the dictionary allows it
      const displayArt = item.display.trim().split(" ")[0];
      const fromDisplay: NounGender | undefined =
        displayArt === "der" ? "m" : displayArt === "das" ? "n" : displayArt === "die" ? (main.g?.includes("pl") ? "pl" : "f") : undefined;
      const gender: NounGender =
        fromDisplay && (!main.g || main.g.includes(fromDisplay)) ? fromDisplay : ((main.g?.[0] as NounGender) ?? fromDisplay ?? "m");
      const pluralOnly = gender === "pl";
      w.noun = {
        gender,
        article: articleOf(gender),
        plural: pluralOnly ? lemma : (main.noun?.pl?.[0] ?? null),
      };
      if (main.noun?.gs?.[0]) w.noun.genitive = main.noun.gs[0];
      if (pluralOnly) w.noun.pluralOnly = true;
      if (!pluralOnly && !w.display.match(/^(der|die|das) /)) w.display = `${articleOf(gender)} ${lemma}`;
    }
    if (pos === "verb" && main?.verb) {
      const v = main.verb;
      w.verb = {
        present3: v.p3 ?? lemma,
        past3: v.pt ?? "",
        participle: v.pp ?? "",
        aux: v.aux?.length === 2 ? "haben/sein" : (v.aux?.[0] ?? "haben"),
        irregular: Boolean(v.irr),
      };
      if (v.sep) w.verb.separable = v.sep;
      if (item.reflexive) w.verb.reflexive = true;
    }
    if (pos === "adj" && main?.adj) {
      w.adj = {};
      if (main.adj.cmp?.[0]) w.adj.comparative = main.adj.cmp[0];
      if (main.adj.sup?.[0]) w.adj.superlative = "am " + main.adj.sup[0];
    }
    words.push(w);
  }

  const bank: WordBank = {
    version: 1,
    built: new Date().toISOString().slice(0, 10),
    sources: [
      "Frequencies: wordfreq (CC BY-SA 4.0)",
      "Grammar, IPA, forms: English Wiktionary via kaikki.org (CC BY-SA 4.0 / GFDL)",
      "Meanings, CEFR levels, topics, examples: LLM-generated and reviewed",
    ],
    words,
  };
  fs.writeFileSync(IDS_FILE, JSON.stringify(ids, null, 0).replace(/,"/g, ',\n"') + "\n");
  fs.writeFileSync(
    WORDS_FILE,
    `{"version":${bank.version},"built":${JSON.stringify(bank.built)},"sources":${JSON.stringify(bank.sources)},"words":[\n` +
      words.map((w) => JSON.stringify(w)).join(",\n") +
      "\n]}\n",
  );
  const byLevel = words.reduce<Record<string, number>>((a, w) => ((a[w.cefr] = (a[w.cefr] ?? 0) + 1), a), {});
  console.log(`  wrote ${words.length} words to data/words.json (${JSON.stringify(byLevel)})`);
  const pending = cands.filter((c) => c.rank <= LIMIT && !cache.has(c.key)).length;
  if (pending) console.log(`  note: ${pending} candidates up to rank ${LIMIT} have no LLM review yet.`);
}

async function main() {
  loadEnvLocal();
  let cands: CompactCandidate[];
  if (STEP === "all" || STEP === "candidates") cands = stepCandidates();
  else cands = readCandidates();
  if (STEP === "candidates") return;
  if (STEP === "all" || STEP === "enrich") await stepEnrich(cands);
  if (STEP === "all" || STEP === "examples") {
    const { stepExamples } = await import("./lib/examples");
    await stepExamples(cands, { model: MODEL });
  }
  if (STEP === "all" || STEP === "assemble") stepAssemble(cands);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
