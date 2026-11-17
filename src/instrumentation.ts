/**
 * Runs once when the server starts: make sure the dictionary database exists
 * (it is imported from data/dict/de-en.jsonl.gz the first time, which takes a
 * few seconds) so the first page doesn't have to wait for it.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getDictionaryDb } = await import("./lib/server/dictionary-db");
  const t = Date.now();
  getDictionaryDb();
  const ms = Date.now() - t;
  if (ms > 500) console.log(`Dictionary ready (imported in ${(ms / 1000).toFixed(1)} s).`);
}
