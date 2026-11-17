/**
 * Helper for improving example sentences.
 *
 *   npx tsx scripts/check-example.ts --list [--from 60]      flagged examples with their problems
 *   npx tsx scripts/check-example.ts --allowed 1234          lemmas ranked before 1234
 *   npx tsx scripts/check-example.ts proposals.jsonl         check {"key","de","en"} lines
 *
 * Uses the same lemmatizer as the app and as npm run validate:words.
 */
import fs from "node:fs";
import path from "node:path";
import type { WordBank } from "../src/lib/words/types";
import { checkExample, lookupFor, problemScore } from "./lib/validate";

const ROOT = path.resolve(__dirname, "..");
const bank: WordBank = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "words.json"), "utf8"));
const lookup = lookupFor(bank.words);
const byKey = new Map(bank.words.map((w) => [w.key, w]));
const args = process.argv.slice(2);

if (args[0] === "--list") {
  const from = Number(args[args.indexOf("--from") + 1] || 60);
  for (const w of bank.words) {
    if (!w.example?.flagged || w.rank < from) continue;
    const c = checkExample(w, w.example.de, lookup);
    console.log(
      JSON.stringify({
        key: w.key,
        rank: w.rank,
        word: w.display,
        meaning: w.meanings[0],
        de: w.example.de,
        en: w.example.en,
        missingTarget: !c.hasTarget || undefined,
        later: c.later.length ? c.later : undefined,
      }),
    );
  }
} else if (args[0] === "--allowed") {
  const rank = Number(args[1]);
  console.log(
    bank.words
      .filter((w) => w.rank < rank)
      .map((w) => w.lemma)
      .join(", "),
  );
} else if (args[0]) {
  let better = 0;
  let total = 0;
  for (const line of fs.readFileSync(args[0], "utf8").split("\n")) {
    if (!line.trim()) continue;
    const p = JSON.parse(line) as { key: string; de: string; en: string };
    const w = byKey.get(p.key);
    if (!w) {
      console.log(`UNKNOWN KEY ${p.key}`);
      continue;
    }
    total++;
    const now = checkExample(w, w.example!.de, lookup);
    const c = checkExample(w, p.de, lookup);
    const ok = problemScore(c) < problemScore(now);
    if (ok) better++;
    console.log(
      `${ok ? "BETTER" : problemScore(c) === 0 ? "PERFECT" : "worse/same"}  ${w.rank} ${p.key}: target=${c.hasTarget} later=[${c.later.join(",")}] outside=[${c.outside.join(",")}]  "${p.de}"`,
    );
  }
  console.log(`${better} of ${total} proposals are better than the current sentence`);
} else {
  console.log("usage: --list | --allowed <rank> | <proposals.jsonl>");
}
