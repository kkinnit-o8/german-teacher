/**
 * Export and import of all progress (everything in data/progress.sqlite).
 */
import "server-only";
import { getDb, TABLES } from "./db";
import { invalidateWords } from "./words";

export const BACKUP_FORMAT = "german-teacher-backup";

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  schemaVersion: number;
  tables: Record<string, Record<string, unknown>[]>;
}

export function exportBackup(): Backup {
  const db = getDb();
  const tables: Backup["tables"] = {};
  for (const t of TABLES) tables[t] = db.prepare(`SELECT * FROM ${t}`).all() as Record<string, unknown>[];
  return {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    schemaVersion: db.pragma("user_version", { simple: true }) as number,
    tables,
  };
}

/** Replace all progress with the backup. Throws on an invalid file (nothing is changed then). */
export function importBackup(data: unknown): { rows: number } {
  const b = data as Backup;
  if (!b || b.format !== BACKUP_FORMAT || typeof b.tables !== "object") throw new Error("This is not a German Teacher backup file.");
  const db = getDb();
  const current = db.pragma("user_version", { simple: true }) as number;
  if (b.schemaVersion > current) throw new Error("This backup comes from a newer version of the app. Update the app first.");
  let rows = 0;
  db.transaction(() => {
    for (const t of TABLES) db.prepare(`DELETE FROM ${t}`).run();
    for (const t of TABLES) {
      const list = b.tables[t];
      if (!Array.isArray(list)) continue;
      const cols = (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name);
      for (const row of list) {
        const keys = Object.keys(row).filter((k) => cols.includes(k));
        if (!keys.length) continue;
        db.prepare(`INSERT INTO ${t} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`).run(
          ...keys.map((k) => row[k] as never),
        );
        rows++;
      }
    }
  })();
  invalidateWords();
  return { rows };
}
