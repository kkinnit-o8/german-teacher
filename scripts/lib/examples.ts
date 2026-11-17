/**
 * Step 3 of the word bank build: validate example sentences with the same
 * lemmatizer the app's renderer uses. Implemented in phase 2.
 */
import type { CompactCandidate } from "../build-words";

export async function stepExamples(_cands: CompactCandidate[], _opts: { model: string }) {
  console.log("Step 3: examples (validation arrives with the lemmatizer; skipped)");
}
