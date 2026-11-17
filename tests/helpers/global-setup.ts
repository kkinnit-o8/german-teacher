import path from "node:path";
import os from "node:os";

/** Import the dictionary into SQLite once, before the test workers start. */
export default async function setup() {
  process.env.GT_DATA_DIR = path.join(os.tmpdir(), "german-teacher-test-data");
  const { getDictionaryDb, closeDictionaryDb } = await import("../../src/lib/server/dictionary-db");
  getDictionaryDb();
  closeDictionaryDb();
}
