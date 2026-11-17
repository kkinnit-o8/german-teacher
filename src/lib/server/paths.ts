import path from "node:path";

/** Project root (where package.json is). */
export const ROOT = process.cwd();

/** Folder for the SQLite files. Tests point GT_DATA_DIR at a temp folder. */
export function dataDir(): string {
  return process.env.GT_DATA_DIR ? path.resolve(process.env.GT_DATA_DIR) : path.join(ROOT, "data");
}

export const WORDS_JSON = path.join(ROOT, "data", "words.json");
export const DICT_GZ = path.join(ROOT, "data", "dict", "de-en.jsonl.gz");
export const WORDFREQ_GZ = path.join(ROOT, "data", "sources", "wordfreq-de.tsv.gz");
