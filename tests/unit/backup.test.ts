import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryDb } from "../../src/lib/server/db";
import { exportBackup, importBackup } from "../../src/lib/server/backup";
import { markLearned, learnedOnDay } from "../../src/lib/server/session";
import { getSettings, saveSettings } from "../../src/lib/server/settings";
import { wordBank } from "../../src/lib/server/words";

beforeEach(() => {
  useMemoryDb();
});

describe("backup", () => {
  it("exports and imports all progress", () => {
    const ids = wordBank().words.slice(0, 3).map((w) => w.id);
    for (const id of ids) markLearned(id, "2026-11-17");
    saveSettings({ newPerDay: 7 });
    const b = JSON.parse(JSON.stringify(exportBackup()));
    useMemoryDb();
    expect(learnedOnDay("2026-11-17")).toEqual([]);
    importBackup(b);
    expect(learnedOnDay("2026-11-17").sort()).toEqual([...ids].sort());
    expect(getSettings().newPerDay).toBe(7);
  });

  it("rejects files that are not backups, without touching the data", () => {
    markLearned(wordBank().words[0].id, "2026-11-17");
    expect(() => importBackup({ hello: 1 })).toThrow(/not a German Teacher backup/);
    expect(learnedOnDay("2026-11-17").length).toBe(1);
  });
});
