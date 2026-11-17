import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";
import type { DictEntry } from "./types";

export const DICT_GZ = path.join(process.cwd(), "data", "dict", "de-en.jsonl.gz");

export interface DictMeta {
  source: string;
  license: string;
  built: string;
  entries: number;
}

/** Read the committed compact dictionary (data/dict/de-en.jsonl.gz) into memory. */
export function readDictGz(file = DICT_GZ): { meta: DictMeta; entries: DictEntry[] } {
  const text = zlib.gunzipSync(fs.readFileSync(file)).toString("utf8");
  const entries: DictEntry[] = [];
  let meta: DictMeta | null = null;
  for (const line of text.split("\n")) {
    if (!line) continue;
    const obj = JSON.parse(line);
    if (obj._meta) meta = obj;
    else entries.push(obj);
  }
  if (!meta) throw new Error("dictionary file has no meta line");
  return { meta, entries };
}
