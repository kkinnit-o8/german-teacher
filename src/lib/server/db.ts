/**
 * The progress database (data/progress.sqlite, git-ignored): everything the
 * learner does. The schema is created and migrated on first use.
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { dataDir } from "./paths";

type DB = Database.Database;

const MIGRATIONS: string[] = [
  // 1: initial schema
  `
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE custom_words (id INTEGER PRIMARY KEY, key TEXT NOT NULL UNIQUE, data TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE learned (word_id INTEGER PRIMARY KEY, day TEXT NOT NULL, at TEXT NOT NULL);
  CREATE TABLE cards (word_id INTEGER PRIMARY KEY, card TEXT NOT NULL, due TEXT NOT NULL, last_rated_day TEXT);
  CREATE INDEX cards_due ON cards(due);
  CREATE TABLE review_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, word_id INTEGER NOT NULL, day TEXT NOT NULL,
    rating INTEGER NOT NULL, source TEXT NOT NULL, counted INTEGER NOT NULL, at TEXT NOT NULL);
  CREATE INDEX review_log_day ON review_log(day);
  CREATE TABLE queue (word_id INTEGER PRIMARY KEY, added_at TEXT NOT NULL, source TEXT NOT NULL);
  CREATE TABLE days (day TEXT PRIMARY KEY, state TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0, completed_at TEXT);
  CREATE TABLE conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, kind TEXT NOT NULL, topic TEXT NOT NULL,
    model TEXT, target INTEGER NOT NULL DEFAULT 10, created_at TEXT NOT NULL,
    cost REAL NOT NULL DEFAULT 0, tokens_in INTEGER NOT NULL DEFAULT 0, tokens_out INTEGER NOT NULL DEFAULT 0);
  CREATE INDEX conversations_day ON conversations(day);
  CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id INTEGER NOT NULL, role TEXT NOT NULL,
    text TEXT NOT NULL, translation TEXT, correction TEXT, hint TEXT, raw TEXT, created_at TEXT NOT NULL);
  CREATE INDEX messages_conv ON messages(conversation_id);
  CREATE TABLE seen_words (
    source TEXT NOT NULL, ref TEXT NOT NULL, word_key TEXT NOT NULL, lemma TEXT NOT NULL, gloss TEXT,
    word_id INTEGER, dict_id INTEGER, day TEXT NOT NULL, PRIMARY KEY (source, ref, word_key));
  CREATE TABLE game_progress (mission_id TEXT PRIMARY KEY, best_stars INTEGER NOT NULL, completed_at TEXT NOT NULL);
  CREATE TABLE game_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, mission_id TEXT NOT NULL, state TEXT NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, finished INTEGER NOT NULL DEFAULT 0,
    cost REAL NOT NULL DEFAULT 0);
  `,
];

let db: DB | null = null;

export function migrate(d: DB) {
  const version = d.pragma("user_version", { simple: true }) as number;
  for (let v = version; v < MIGRATIONS.length; v++) {
    d.transaction(() => {
      d.exec(MIGRATIONS[v]);
      d.pragma(`user_version = ${v + 1}`);
    })();
  }
}

export function getDb(): DB {
  if (db) return db;
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  const d = new Database(path.join(dir, "progress.sqlite"));
  d.pragma("journal_mode = WAL");
  d.pragma("foreign_keys = ON");
  migrate(d);
  db = d;
  return d;
}

/** Open an in-memory database (tests). */
export function useMemoryDb(): DB {
  db?.close();
  const d = new Database(":memory:");
  migrate(d);
  db = d;
  return d;
}

export function closeDb() {
  db?.close();
  db = null;
}

export const TABLES = [
  "settings",
  "custom_words",
  "learned",
  "cards",
  "review_log",
  "queue",
  "days",
  "conversations",
  "messages",
  "seen_words",
  "game_progress",
  "game_sessions",
] as const;
