/**
 * npm run build:dict
 *
 * Builds the compact German–English dictionary data/dict/de-en.jsonl.gz from
 * the German section of English Wiktionary as extracted by kaikki.org
 * (wiktextract). Licence of the data: CC BY-SA 4.0 and GFDL.
 *
 * The compact file is committed to the repo, so you normally never need to run
 * this. The app imports it into data/dictionary.sqlite on first start.
 *
 * Input (first that exists):
 *   1. a path given on the command line (.jsonl or .jsonl.gz)
 *   2. data/raw/kaikki-de.jsonl
 *   3. a download of the German-only file from kaikki.org (about 1 GB), or if
 *      that file has been removed, the full English Wiktionary dump (2.9 GB
 *      compressed), filtered to German while streaming.
 * The raw download is git-ignored and never committed.
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import zlib from "node:zlib";
import https from "node:https";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { parseKaikki, type FormOfLink } from "./lib/kaikki";
import type { DictEntry } from "../src/lib/dict/types";
import { loadWordfreq } from "./lib/wordfreq";

const ROOT = path.resolve(__dirname, "..");
const RAW_DIR = path.join(ROOT, "data", "raw");
const RAW_FILE = path.join(RAW_DIR, "kaikki-de.jsonl");
const OUT_FILE = path.join(ROOT, "data", "dict", "de-en.jsonl.gz");

const SOURCES = [
  { url: "https://kaikki.org/dictionary/German/kaikki.org-dictionary-German.jsonl", gz: false, filter: false },
  { url: "https://kaikki.org/dictionary/raw-wiktextract-data.jsonl.gz", gz: true, filter: true },
];

function get(url: string): Promise<import("node:http").IncomingMessage> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          resolve(get(new URL(res.headers.location, url).toString()));
        } else if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        } else resolve(res);
      })
      .on("error", reject);
  });
}

async function download(): Promise<void> {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  for (const src of SOURCES) {
    try {
      console.log(`Downloading ${src.url} ...`);
      const res = await get(src.url);
      const total = Number(res.headers["content-length"] ?? 0);
      let done = 0;
      let lastLog = 0;
      res.on("data", (c: Buffer) => {
        done += c.length;
        if (done - lastLog > 50e6) {
          lastLog = done;
          console.log(`  ${(done / 1e6).toFixed(0)} MB${total ? ` of ${(total / 1e6).toFixed(0)} MB` : ""}`);
        }
      });
      const tmp = RAW_FILE + ".part";
      const out = fs.createWriteStream(tmp);
      if (!src.filter) {
        await pipeline(res, out);
      } else {
        // keep only German entries while streaming the full dump
        let buf = "";
        const filter = new Transform({
          transform(chunk, _enc, cb) {
            buf += chunk.toString("utf8");
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";
            const keep = lines.filter((l) => l.includes('"lang_code": "de"') || l.includes('"lang_code":"de"'));
            cb(null, keep.length ? keep.join("\n") + "\n" : "");
          },
          flush(cb) {
            cb(null, buf.includes('"lang_code": "de"') ? buf + "\n" : "");
          },
        });
        await pipeline(res, zlib.createGunzip(), filter, out);
      }
      fs.renameSync(tmp, RAW_FILE);
      return;
    } catch (e) {
      console.warn(`  failed: ${(e as Error).message}`);
    }
  }
  throw new Error("Could not download the Wiktionary data from kaikki.org.");
}

async function main() {
  let input = process.argv[2];
  if (!input) {
    if (fs.existsSync(RAW_FILE)) input = RAW_FILE;
    else if (fs.existsSync(RAW_FILE + ".gz")) input = RAW_FILE + ".gz";
    else {
      await download();
      input = RAW_FILE;
    }
  }
  console.log(`Reading ${input}`);
  const freq = loadWordfreq();
  const freqSet = new Set(freq.keys());

  let stream: NodeJS.ReadableStream = fs.createReadStream(input);
  if (input.endsWith(".gz")) stream = stream.pipe(zlib.createGunzip());
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  const entries: Omit<DictEntry, "id">[] = [];
  const links: FormOfLink[] = [];
  let n = 0;
  for await (const line of rl) {
    if (!line) continue;
    n++;
    if (n % 50000 === 0) console.log(`  ${n} lines`);
    let raw;
    try {
      raw = JSON.parse(line);
    } catch {
      continue;
    }
    const r = parseKaikki(raw);
    if (r.kind === "entry") entries.push(r.entry);
    else if (r.kind === "formof") links.push(...r.links);
  }
  console.log(`Parsed ${n} lines: ${entries.length} lemma entries, ${links.length} form-of links`);

  // fold form-of links into their target entries (same part of speech)
  const byKey = new Map<string, Omit<DictEntry, "id">[]>();
  for (const e of entries) {
    const k = e.w + "|" + e.p;
    const list = byKey.get(k);
    if (list) list.push(e);
    else byKey.set(k, [e]);
  }
  let folded = 0;
  for (const l of links) {
    const targets = byKey.get(l.target + "|" + l.pos);
    if (!targets) continue;
    const t = targets[0];
    t.f ??= [];
    if (!t.f.some(([f]) => f === l.form || f.split(" ")[0] === l.form)) {
      t.f.push([l.form, l.code]);
      folded++;
    }
  }
  console.log(`Folded ${folded} extra forms from form-of entries`);

  // resolve "@female:Freund" style meanings from derivational form-of senses
  const meaningByWord = new Map<string, string>();
  for (const e of entries) {
    const m = e.m.find((x) => !x.startsWith("@"));
    if (m && !meaningByWord.has(e.w)) meaningByWord.set(e.w, m);
  }
  const firstMeaning = (w: string) => meaningByWord.get(w);
  for (const e of entries) {
    e.m = e.m
      .map((m) => {
        const r = m.match(/^@(\w+):(.+)$/);
        if (!r) return m;
        const base = firstMeaning(r[2]);
        if (!base) return "";
        if (r[1] === "female") return `${base} (female)`;
        if (r[1] === "male") return `${base} (male)`;
        if (r[1] === "dim") return `little ${base}`;
        if (r[1] === "agent") return base.startsWith("to ") ? `one who ${base.slice(3)}s` : base;
        return base;
      })
      .filter(Boolean);
  }
  const resolvedEntries = entries.filter((e) => e.m.length);
  entries.length = 0;
  entries.push(...resolvedEntries);

  // keep entries that occur in everyday text (any form in the wordfreq top list),
  // and every function word
  const ALWAYS = new Set(["pron", "det", "art", "prep", "conj", "num", "part", "intj"]);
  const kept = entries.filter((e) => {
    if (ALWAYS.has(e.p)) return true;
    if (e.tg?.some((t) => ["obsolete", "archaic", "misspelling"].includes(t))) return false;
    if (freqSet.has(e.w.toLowerCase())) return true;
    for (const [f] of e.f ?? []) {
      const first = f.split(" ")[0].toLowerCase();
      if (freqSet.has(first)) return true;
    }
    return false;
  });
  kept.sort((a, b) => (a.w < b.w ? -1 : a.w > b.w ? 1 : a.p < b.p ? -1 : a.p > b.p ? 1 : 0));
  console.log(`Keeping ${kept.length} entries`);

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  const gz = zlib.createGzip({ level: 9 });
  const out = fs.createWriteStream(OUT_FILE);
  const done = pipeline(gz, out);
  gz.write(
    JSON.stringify({
      _meta: true,
      source: "English Wiktionary (German entries) via kaikki.org / wiktextract",
      license: "CC BY-SA 4.0 and GFDL",
      built: new Date().toISOString().slice(0, 10),
      entries: kept.length,
    }) + "\n",
  );
  kept.forEach((e, i) => {
    gz.write(JSON.stringify({ id: i + 1, ...e }) + "\n");
  });
  gz.end();
  await done;
  console.log(`Wrote ${OUT_FILE} (${(fs.statSync(OUT_FILE).size / 1e6).toFixed(1)} MB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
