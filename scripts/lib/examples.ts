/**
 * Step 3 of the word bank build: regenerate example sentences that fail
 * validation (target word missing, or words ranked after the target), with an
 * LLM through OpenRouter. Up to 3 attempts per word; the best attempt is kept,
 * and anything still imperfect stays flagged in data/words.json.
 */
import fs from "node:fs";
import type { WordBank } from "../../src/lib/words/types";
import { complete, extractJson, getApiKey } from "../../src/lib/openrouter";
import { EXAMPLE_FIX_SCHEMA, EXAMPLE_FIX_SYSTEM } from "./enrich-prompt";
import { checkExample, lookupFor, problemScore, type ExampleCheck } from "./validate";

const BATCH = 15;
const ATTEMPTS = 3;
/** below this rank a perfect sentence is impossible (there are too few earlier words) */
const MIN_RANK = 60;

export async function stepExamples(opts: { model: string; fixesFile: string; wordsFile: string }): Promise<boolean> {
  console.log("Step 3: examples (regenerate sentences that fail validation)");
  const bank: WordBank = JSON.parse(fs.readFileSync(opts.wordsFile, "utf8"));
  const lookup = lookupFor(bank.words);
  const failing = bank.words.filter((w) => w.example?.flagged && w.rank >= MIN_RANK);
  console.log(`  ${failing.length} flagged examples from rank ${MIN_RANK} on`);
  if (!failing.length) return false;
  if (!getApiKey()) {
    console.log("  No OPENROUTER_API_KEY: skipping regeneration (examples stay flagged).");
    return false;
  }
  let improved = 0;
  for (let i = 0; i < failing.length; i += BATCH) {
    const batch = failing.slice(i, i + BATCH);
    const maxRank = Math.max(...batch.map((w) => w.rank));
    const allowed = bank.words
      .filter((w) => w.rank < maxRank)
      .map((w) => `${w.rank}:${w.lemma}`)
      .join(", ");
    const best = new Map<string, { de: string; en: string; check: ExampleCheck }>();
    for (const w of batch) best.set(w.key, { de: w.example!.de, en: w.example!.en, check: checkExample(w, w.example!.de, lookup) });
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      const todo = batch.filter((w) => problemScore(best.get(w.key)!.check) > 0);
      if (!todo.length) break;
      const user =
        `Word bank (rank:lemma). A word may only use words with a LOWER rank than itself, plus names and numbers:\n${allowed}\n\n` +
        todo
          .map((w) => {
            const b = best.get(w.key)!;
            const problems = [
              !b.check.hasTarget ? "missing target" : "",
              b.check.later.length ? `later words: ${b.check.later.join(", ")}` : "",
            ]
              .filter(Boolean)
              .join("; ");
            return JSON.stringify({ key: w.key, rank: w.rank, word: w.display, meaning: w.meanings[0], current: b.de, problems });
          })
          .join("\n");
      try {
        const res = await complete({
          model: opts.model,
          messages: [
            { role: "system", content: EXAMPLE_FIX_SYSTEM },
            { role: "user", content: user },
          ],
          schema: { name: "example_fixes", schema: EXAMPLE_FIX_SCHEMA as unknown as Record<string, unknown> },
          maxTokens: 3000,
          temperature: 0.7,
        });
        const parsed = extractJson(res.text) as { items?: { key: string; de: string; en: string }[] } | undefined;
        for (const it of parsed?.items ?? []) {
          const w = todo.find((x) => x.key === it.key);
          if (!w || !it.de || !it.en) continue;
          const check = checkExample(w, it.de, lookup);
          if (problemScore(check) < problemScore(best.get(w.key)!.check)) best.set(w.key, { de: it.de, en: it.en, check });
        }
      } catch (e) {
        console.warn(`  attempt ${attempt} failed: ${(e as Error).message}`);
        if ((e as { kind?: string }).kind === "auth") throw e;
      }
    }
    const lines: string[] = [];
    for (const w of batch) {
      const b = best.get(w.key)!;
      if (b.de !== w.example!.de) {
        lines.push(JSON.stringify({ key: w.key, de: b.de, en: b.en, source: `openrouter:${opts.model}` }));
        improved++;
      }
    }
    if (lines.length) fs.appendFileSync(opts.fixesFile, lines.join("\n") + "\n");
    console.log(`  ranks ${batch[0].rank}-${maxRank}: ${lines.length} improved`);
  }
  return improved > 0;
}
