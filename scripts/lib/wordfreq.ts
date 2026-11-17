import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const FILE = path.resolve(__dirname, "..", "..", "data", "sources", "wordfreq-de.tsv.gz");

/** word (lowercase) -> frequency per billion words, in descending order of frequency */
export function loadWordfreq(): Map<string, number> {
  const text = zlib.gunzipSync(fs.readFileSync(FILE)).toString("utf8");
  const map = new Map<string, number>();
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const [w, f] = line.split("\t");
    map.set(w, Number(f));
  }
  return map;
}
