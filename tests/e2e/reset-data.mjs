// Fresh progress database for every e2e run (the dictionary database is kept to save time).
import fs from "node:fs";
import path from "node:path";
const dir = path.join(process.cwd(), "tests", "e2e", ".data");
fs.mkdirSync(dir, { recursive: true });
for (const f of fs.readdirSync(dir)) if (!f.startsWith("dictionary.sqlite")) fs.rmSync(path.join(dir, f), { force: true });
