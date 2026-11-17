/**
 * Quick checker for LLM review files in data/build/enrich/*.jsonl.
 *
 *   npx tsx scripts/check-enrich.ts data/build/enrich/some-file.jsonl [--from 1 --to 300]
 *
 * Checks: valid JSON lines, required fields and enums, meanings[0] short,
 * every candidate in the rank range present, and (roughly, by dictionary forms)
 * that the example contains the target word. Also lists example words that
 * belong to candidates ranked after the target. The full validation with the
 * app's lemmatizer is `npm run validate:words`.
 */
import fs from "node:fs";
import path from "node:path";
import { readDictGz } from "../src/lib/dict/read";
import { FAMILY_BY_KEY, CONTRACTIONS } from "../src/lib/german/function-words";
import { TOPICS } from "../src/lib/words/types";
import type { CompactCandidate } from "./build-words";

const file = process.argv[2];
const arg = (n: string, d: number) => {
  const i = process.argv.indexOf(n);
  return i > 0 ? Number(process.argv[i + 1]) : d;
};
const from = arg("--from", 1);
const to = arg("--to", 100000);
const keysFileIdx = process.argv.indexOf("--keys");
const keyList: Set<string> | null =
  keysFileIdx > 0 ? new Set(JSON.parse(fs.readFileSync(process.argv[keysFileIdx + 1], "utf8")) as string[]) : null;
const cands: CompactCandidate[] = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "..", "data", "build", "candidates.json"), "utf8"),
);
const { entries } = readDictGz();
const formsByLemma = new Map<string, Set<string>>();
for (const e of entries) {
  const s = formsByLemma.get(e.w) ?? new Set<string>();
  s.add(e.w.toLowerCase());
  for (const [f] of e.f ?? []) for (const part of f.toLowerCase().split(" ")) s.add(part);
  formsByLemma.set(e.w, s);
}
const formsOf = (c: CompactCandidate, lemma: string) => {
  const fam = FAMILY_BY_KEY.get(c.key);
  if (fam) return new Set(Object.keys(fam.forms));
  const s = new Set(formsByLemma.get(lemma) ?? formsByLemma.get(c.lemma) ?? [lemma.toLowerCase()]);
  return s;
};
// form -> lowest rank of a candidate having that form
const rankOfForm = new Map<string, number>();
for (const c of cands) {
  for (const f of formsOf(c, c.lemma)) if (!rankOfForm.has(f)) rankOfForm.set(f, c.rank);
}
for (const [k, [p, a]] of Object.entries(CONTRACTIONS)) rankOfForm.set(k, Math.max(rankOfForm.get(p) ?? 1, 1, rankOfForm.get(a) ?? 1));

const lines = fs.readFileSync(file, "utf8").split("\n").filter((l) => l.trim());
const seen = new Set<string>();
let problems = 0;
const byKey = new Map(cands.map((c) => [c.key, c]));
for (const [i, line] of lines.entries()) {
  let it;
  try {
    it = JSON.parse(line);
  } catch {
    console.log(`line ${i + 1}: invalid JSON`);
    problems++;
    continue;
  }
  const c = byKey.get(it.key);
  const where = `${it.key}`;
  if (!c) {
    console.log(`${where}: key not in candidates.json`);
    problems++;
    continue;
  }
  seen.add(it.key);
  const errs: string[] = [];
  for (const f of ["keep", "lemma", "pos", "display", "meanings", "cefr", "topic", "reflexive", "example"])
    if (it[f] === undefined) errs.push(`missing ${f}`);
  if (it.keep === false) {
    if (!it.drop_reason) errs.push("drop without drop_reason");
  } else {
    if (!["A1", "A2", "B1"].includes(it.cefr)) errs.push(`bad cefr ${it.cefr}`);
    if (!(TOPICS as readonly string[]).includes(it.topic)) errs.push(`bad topic ${it.topic}`);
    if (!Array.isArray(it.meanings) || !it.meanings.length) errs.push("no meanings");
    else if (it.meanings[0].length > 25) errs.push(`meanings[0] too long (${it.meanings[0].length})`);
    if (it.pos === "verb" && it.meanings?.[0] && !/^to /.test(it.meanings[0])) errs.push(`verb meaning should start with "to"`);
    const de: string = it.example?.de ?? "";
    const toks = de
      .toLowerCase()
      .replace(/[^a-zäöüß' -]/g, " ")
      .split(/[\s-]+/)
      .map((t) => t.replace(/'s$/, ""))
      .filter(Boolean);
    const forms = formsOf(c, it.lemma);
    if (!toks.some((t) => forms.has(t))) errs.push(`example may not contain the word: "${de}"`);
    const later = toks.filter((t) => {
      const r = rankOfForm.get(t);
      return r !== undefined && r > c.rank && !forms.has(t);
    });
    const unknown = toks.filter((t) => rankOfForm.get(t) === undefined && !forms.has(t));
    if (later.length || unknown.length)
      console.log(
        `  info ${c.rank} ${it.lemma}: later=[${later.join(",")}] not-in-list=[${unknown.join(",")}]`,
      );
  }
  if (errs.length) {
    problems++;
    console.log(`${where}: ${errs.join("; ")}`);
  }
}
const missing = cands.filter((c) =>
  keyList ? keyList.has(c.key) && !seen.has(c.key) : c.rank >= from && c.rank <= to && !seen.has(c.key),
);
if (missing.length) {
  problems++;
  console.log(`missing ${missing.length} candidates: ${missing.slice(0, 20).map((c) => c.key).join(", ")}${missing.length > 20 ? " ..." : ""}`);
}
console.log(`${lines.length} lines checked, ${problems} problems`);
