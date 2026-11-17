/**
 * npm run validate:words
 *
 * Checks data/words.json:
 *  - every word has the required fields (meanings, CEFR level, topic, grammar);
 *  - every example sentence contains its target word (checked with the same
 *    lemmatizer the renderer uses);
 *  - lists words in each example that are ranked after the target word.
 * Writes data/build/examples-report.json and prints a summary.
 * Exit code 1 if a word is broken or an example misses its target.
 */
import fs from "node:fs";
import path from "node:path";
import type { WordBank } from "../src/lib/words/types";
import { TOPICS } from "../src/lib/words/types";
import { checkExample, lookupFor, type ExampleCheck } from "./lib/validate";

const ROOT = path.resolve(__dirname, "..");
const bank: WordBank = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "words.json"), "utf8"));
const verbose = process.argv.includes("--verbose");
const lookup = lookupFor(bank.words);

const errors: string[] = [];
const checks: ExampleCheck[] = [];
const seenIds = new Set<number>();
const seenKeys = new Set<string>();
for (const w of bank.words) {
  const where = `${w.rank} ${w.display}`;
  if (seenIds.has(w.id)) errors.push(`${where}: duplicate id ${w.id}`);
  if (seenKeys.has(w.key)) errors.push(`${where}: duplicate key ${w.key}`);
  seenIds.add(w.id);
  seenKeys.add(w.key);
  if (!w.meanings?.length || !w.meanings[0]) errors.push(`${where}: no meaning`);
  if (!["A1", "A2", "B1"].includes(w.cefr)) errors.push(`${where}: bad CEFR level ${w.cefr}`);
  if (!(TOPICS as readonly string[]).includes(w.topic)) errors.push(`${where}: bad topic ${w.topic}`);
  if (w.pos === "noun" && !w.noun) errors.push(`${where}: noun without gender/plural data`);
  if (w.pos === "verb" && !w.verb) errors.push(`${where}: verb without forms`);
  if (!w.example?.de) {
    errors.push(`${where}: no example sentence`);
    continue;
  }
  checks.push(checkExample(w, w.example.de, lookup));
}

const missing = checks.filter((c) => !c.hasTarget);
const withLater = checks.filter((c) => c.later.length);
const perfect = checks.filter((c) => c.hasTarget && !c.later.length);
const report = {
  checked: checks.length,
  perfect: perfect.length,
  missingTarget: missing.length,
  withLaterWords: withLater.length,
  items: Object.fromEntries(
    checks.map((c) => [
      c.key,
      {
        ...(c.hasTarget ? {} : { missingTarget: true }),
        ...(c.later.length ? { later: c.later } : {}),
        ...(c.outside.length ? { outside: c.outside } : {}),
      },
    ]),
  ),
};
fs.writeFileSync(path.join(ROOT, "data", "build", "examples-report.json"), JSON.stringify(report, null, 1) + "\n");

for (const e of errors) console.log("ERROR " + e);
for (const c of missing) console.log(`MISSING TARGET  ${c.rank} ${c.key}: ${c.de}`);
if (verbose) for (const c of withLater) console.log(`later words     ${c.rank} ${c.key}: ${c.later.join(", ")}  | ${c.de}`);
const laterCounts = withLater.reduce<Record<number, number>>((a, c) => ((a[c.later.length] = (a[c.later.length] ?? 0) + 1), a), {});
console.log(
  `\n${bank.words.length} words, ${checks.length} examples: ${perfect.length} perfect, ` +
    `${missing.length} missing their word, ${withLater.length} use later-ranked words ${JSON.stringify(laterCounts)}.` +
    `\nReport: data/build/examples-report.json${verbose ? "" : " (use --verbose to list later words)"}`,
);
if (errors.length || missing.length) process.exit(1);
