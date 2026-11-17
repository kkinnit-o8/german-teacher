import { isTestMode, setClockOffset } from "@/lib/server/clock";
import { getDb, TABLES } from "@/lib/server/db";
import { invalidateWords } from "@/lib/server/words";

/** Test mode only: wipe all progress and reset the clock, so every e2e test starts fresh. */
export async function POST() {
  if (!isTestMode()) return Response.json({ error: "not available" }, { status: 404 });
  const db = getDb();
  db.transaction(() => {
    for (const t of TABLES) db.prepare(`DELETE FROM ${t}`).run();
  })();
  setClockOffset(0);
  process.env.OPENROUTER_API_KEY = "test-key";
  invalidateWords();
  return Response.json({ ok: true });
}
