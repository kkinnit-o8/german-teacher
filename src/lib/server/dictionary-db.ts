/**
 * The German–English dictionary in SQLite (data/dictionary.sqlite).
 * Imported automatically from the committed data/dict/de-en.jsonl.gz the first
 * time it is needed, and again whenever that file changes.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import Database from "better-sqlite3";
import type { DictEntry } from "../dict/types";
import { DICT_GZ, dataDir } from "./paths";

type DB = Database.Database;

let db: DB | null = null;

function sourceStamp(file: string): string {
  const st = fs.statSync(file);
  return `${st.size}:${Math.round(st.mtimeMs)}`;
}

export function importDictionary(target: DB, gzFile = DICT_GZ) {
  const text = zlib.gunzipSync(fs.readFileSync(gzFile)).toString("utf8");
  target.exec(`
    DROP TABLE IF EXISTS entries;
    DROP TABLE IF EXISTS forms;
    CREATE TABLE entries (id INTEGER PRIMARY KEY, w TEXT NOT NULL, lw TEXT NOT NULL, p TEXT NOT NULL, data TEXT NOT NULL);
    CREATE TABLE forms (lform TEXT NOT NULL, form TEXT NOT NULL, entry_id INTEGER NOT NULL, code TEXT NOT NULL);
  `);
  const insE = target.prepare("INSERT INTO entries (id, w, lw, p, data) VALUES (?, ?, ?, ?, ?)");
  const insF = target.prepare("INSERT INTO forms (lform, form, entry_id, code) VALUES (?, ?, ?, ?)");
  const tx = target.transaction(() => {
    for (const line of text.split("\n")) {
      if (!line) continue;
      const e = JSON.parse(line);
      if (e._meta) continue;
      const entry = e as DictEntry;
      insE.run(entry.id, entry.w, entry.w.toLowerCase(), entry.p, line);
      const seen = new Set<string>();
      const add = (form: string, code: string) => {
        const k = form + "|" + code;
        if (seen.has(k)) return;
        seen.add(k);
        insF.run(form.toLowerCase(), form, entry.id, code);
      };
      add(entry.w, "lemma");
      for (const [f, code] of entry.f ?? []) add(f, code);
    }
  });
  tx();
  target.exec(`
    CREATE INDEX forms_lform ON forms(lform);
    CREATE INDEX entries_lw ON entries(lw);
  `);
}

export function getDictionaryDb(): DB {
  if (db) return db;
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "dictionary.sqlite");
  const stamp = sourceStamp(DICT_GZ);
  let d = new Database(file);
  d.pragma("journal_mode = WAL");
  d.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)");
  const current = d.prepare("SELECT value FROM meta WHERE key = 'source'").get() as { value: string } | undefined;
  if (current?.value !== stamp) {
    // (re)import into a fresh file so a half-finished import is never used
    d.close();
    const tmp = file + ".tmp";
    for (const f of [tmp, tmp + "-wal", tmp + "-shm"]) if (fs.existsSync(f)) fs.rmSync(f);
    const t = new Database(tmp);
    t.pragma("journal_mode = OFF");
    t.pragma("synchronous = OFF");
    t.exec("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT)");
    importDictionary(t);
    t.prepare("INSERT INTO meta (key, value) VALUES ('source', ?)").run(stamp);
    t.close();
    for (const f of [file, file + "-wal", file + "-shm"]) if (fs.existsSync(f)) fs.rmSync(f);
    fs.renameSync(tmp, file);
    d = new Database(file);
    d.pragma("journal_mode = WAL");
  }
  d.pragma("query_only = ON");
  db = d;
  return d;
}

export interface FormRow {
  form: string;
  entry_id: number;
  code: string;
}

const entryCache = new Map<number, DictEntry>();

export function dictEntry(id: number): DictEntry | null {
  const hit = entryCache.get(id);
  if (hit) return hit;
  const row = getDictionaryDb().prepare("SELECT data FROM entries WHERE id = ?").get(id) as { data: string } | undefined;
  if (!row) return null;
  const e = JSON.parse(row.data) as DictEntry;
  if (entryCache.size > 20000) entryCache.clear();
  entryCache.set(id, e);
  return e;
}

export function lookupForm(lowerForm: string): FormRow[] {
  return getDictionaryDb()
    .prepare("SELECT form, entry_id, code FROM forms WHERE lform = ?")
    .all(lowerForm) as FormRow[];
}

export function entriesByLemma(lemma: string): DictEntry[] {
  const rows = getDictionaryDb().prepare("SELECT data FROM entries WHERE w = ?").all(lemma) as { data: string }[];
  return rows.map((r) => JSON.parse(r.data));
}

export function searchDictionary(q: string, limit = 30): DictEntry[] {
  const lq = q.trim().toLowerCase();
  if (!lq) return [];
  const d = getDictionaryDb();
  const exact = d
    .prepare(
      "SELECT DISTINCT e.data FROM forms f JOIN entries e ON e.id = f.entry_id WHERE f.lform = ? LIMIT ?",
    )
    .all(lq, limit) as { data: string }[];
  const prefix = d
    .prepare("SELECT data FROM entries WHERE lw LIKE ? ORDER BY length(lw) LIMIT ?")
    .all(lq.replace(/[%_]/g, "") + "%", limit) as { data: string }[];
  const seen = new Set<string>();
  const out: DictEntry[] = [];
  for (const r of [...exact, ...prefix]) {
    if (seen.has(r.data)) continue;
    seen.add(r.data);
    out.push(JSON.parse(r.data));
    if (out.length >= limit) break;
  }
  return out;
}

/** for tests */
export function closeDictionaryDb() {
  db?.close();
  db = null;
  entryCache.clear();
}
