// The one-click start, run by start.cmd (Windows) or `node scripts/start.mjs`.
//  1. npm install when the packages (or the Node version) changed
//  2. ask for the OpenRouter key if .env.local is missing
//  3. build the word bank if data/words.json is missing
//  4. build the app when the code changed since the last build
//  5. start the server on port 3700 and open the browser
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 3700;
const URL_LOCAL = `http://localhost:${PORT}`;
const isWin = process.platform === "win32";
const npm = isWin ? "npm.cmd" : "npm";

const say = (msg = "") => console.log(msg);
const step = (msg) => console.log(`\n== ${msg}`);

class StartError extends Error {}

function run(cmd, args, label) {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", shell: isWin });
  if (r.status !== 0) throw new StartError(`${label} failed (exit code ${r.status}). Scroll up to see the error.`);
}

function hashFiles(files) {
  const h = crypto.createHash("sha1");
  for (const f of files) {
    h.update(f);
    try {
      h.update(fs.readFileSync(path.join(ROOT, f)));
    } catch {
      h.update("missing");
    }
  }
  return h.digest("hex");
}

function listFiles(dir) {
  const out = [];
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(rel));
    else out.push(rel);
  }
  return out.sort();
}

function checkNode() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 20 || (major === 20 && minor < 9))
    throw new StartError(
      `Node.js ${process.versions.node} is too old. Install the current LTS version from https://nodejs.org and start again.`,
    );
}

function installIfNeeded() {
  const stampFile = path.join(ROOT, "node_modules", ".gt-install-stamp");
  const want = hashFiles(["package.json", "package-lock.json"]) + ":" + process.versions.modules;
  const have = fs.existsSync(stampFile) ? fs.readFileSync(stampFile, "utf8") : "";
  if (have === want && fs.existsSync(path.join(ROOT, "node_modules", "next"))) return;
  step("Installing the app's packages (npm install). The first time this takes a few minutes.");
  run(npm, ["install", "--no-audit", "--no-fund"], "npm install");
  // the SQLite module is compiled for one Node version: check it loads
  const check = spawnSync(process.execPath, ["-e", "require('better-sqlite3')(':memory:').close()"], { cwd: ROOT });
  if (check.status !== 0) {
    step("Rebuilding the database module for your Node.js version");
    run(npm, ["rebuild", "better-sqlite3"], "npm rebuild better-sqlite3");
  }
  fs.writeFileSync(stampFile, want);
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => (rl.close(), resolve(a.trim()))));
}

async function ensureKey() {
  const envFile = path.join(ROOT, ".env.local");
  if (fs.existsSync(envFile) && /OPENROUTER_API_KEY\s*=\s*\S/.test(fs.readFileSync(envFile, "utf8"))) return;
  step("OpenRouter API key");
  say("The teacher chat and City Adventures use an AI model through openrouter.ai.");
  say("Create a key at https://openrouter.ai/keys (it starts with sk-or-), then paste it here.");
  say("It is saved only in the file .env.local in this folder and never sent anywhere else.");
  say("Press Enter without typing anything to skip (everything else works without it).");
  const key = await ask("\nYour OpenRouter key: ");
  if (!key) {
    say("No key saved. You can run start.cmd again later, or create .env.local yourself.");
    return;
  }
  if (!/^sk-or-/.test(key)) say("(That doesn't look like an OpenRouter key, but it is saved anyway.)");
  const existing = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8").replace(/^OPENROUTER_API_KEY=.*$/m, "").trim() : "";
  fs.writeFileSync(envFile, `${existing ? existing + "\n" : ""}OPENROUTER_API_KEY=${key}\n`);
  say("Saved to .env.local.");
}

function ensureWordBank() {
  if (fs.existsSync(path.join(ROOT, "data", "words.json"))) return;
  step("Building the word bank (data/words.json is missing)");
  run(npm, ["run", "build:words"], "Building the word bank");
}

function buildIfNeeded() {
  const files = [
    ...listFiles("src"),
    ...listFiles("public"),
    "package-lock.json",
    "next.config.ts",
    "tsconfig.json",
    "postcss.config.mjs",
  ];
  const want = hashFiles(files);
  const stampFile = path.join(ROOT, ".next", "gt-build-stamp");
  const have = fs.existsSync(stampFile) ? fs.readFileSync(stampFile, "utf8") : "";
  if (have === want && fs.existsSync(path.join(ROOT, ".next", "BUILD_ID"))) return;
  step("Building the app (only when the code changed; takes a minute or two)");
  run(npm, ["run", "build"], "Building the app");
  fs.writeFileSync(stampFile, want);
}

function ping() {
  return new Promise((resolve) => {
    const req = http.get(`${URL_LOCAL}/api/settings`, { timeout: 1500 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => (req.destroy(), resolve(false)));
  });
}

function openBrowser() {
  if (process.env.GT_NO_BROWSER) return;
  if (isWin) spawn("cmd", ["/c", "start", "", URL_LOCAL], { detached: true, stdio: "ignore" }).unref();
  else if (process.platform === "darwin") spawn("open", [URL_LOCAL], { detached: true, stdio: "ignore" }).unref();
  else spawn("xdg-open", [URL_LOCAL], { detached: true, stdio: "ignore" }).unref();
}

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces()))
    for (const a of list ?? []) if (a.family === "IPv4" && !a.internal) out.push(`http://${a.address}:${PORT}`);
  return out;
}

async function main() {
  say("German Teacher");
  checkNode();
  if (await ping()) {
    say(`\nThe app is already running. Opening ${URL_LOCAL} ...`);
    openBrowser();
    return;
  }
  installIfNeeded();
  await ensureKey();
  ensureWordBank();
  buildIfNeeded();

  step("Starting");
  const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
  const server = spawn(process.execPath, [nextBin, "start", "-p", String(PORT), "-H", "0.0.0.0"], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production" },
  });
  server.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`\nThe server stopped with an error (exit code ${code}).`);
      console.error(`If it says the port is in use, another program uses port ${PORT}: close it and start again.`);
      process.exitCode = 1;
    }
  });
  for (let i = 0; i < 120; i++) {
    if (await ping()) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  say(`\nGerman Teacher is running at ${URL_LOCAL}`);
  const lan = lanAddresses();
  if (lan.length) say(`On your phone (same Wi-Fi): ${lan.join("  or  ")}`);
  say("Keep this window open while you use the app. Close it to stop the app.\n");
  openBrowser();
}

main().catch((e) => {
  console.error(`\nSomething went wrong: ${e instanceof StartError ? e.message : e?.stack || e}`);
  process.exitCode = 1;
});
