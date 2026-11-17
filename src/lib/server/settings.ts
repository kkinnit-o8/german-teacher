import "server-only";
import { DEFAULT_SETTINGS, sanitizeSettings, type Settings } from "../settings";
import { getDb } from "./db";

export function getSettings(): Settings {
  const rows = getDb().prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const raw: Record<string, unknown> = {};
  for (const r of rows) {
    try {
      raw[r.key] = JSON.parse(r.value);
    } catch {}
  }
  return sanitizeSettings(raw, DEFAULT_SETTINGS);
}

export function saveSettings(patch: Partial<Record<keyof Settings, unknown>>): Settings {
  const next = sanitizeSettings(patch, getSettings());
  const d = getDb();
  const up = d.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  );
  d.transaction(() => {
    for (const k of Object.keys(patch) as (keyof Settings)[]) {
      if (k in next) up.run(k, JSON.stringify(next[k]));
    }
  })();
  return next;
}
