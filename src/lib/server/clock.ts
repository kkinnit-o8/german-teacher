/**
 * The server's notion of "now". End-to-end tests run the server with
 * GT_TEST_MODE=1 and move the clock forward through /api/test/clock, to check
 * what happens on the next learning day. In normal use this is just new Date().
 */
import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./paths";

const testMode = () => process.env.GT_TEST_MODE === "1";
const file = () => path.join(dataDir(), "test-clock.json");

export function clockOffsetMs(): number {
  if (!testMode()) return 0;
  try {
    return Number(JSON.parse(fs.readFileSync(file(), "utf8")).offsetMs) || 0;
  } catch {
    return 0;
  }
}

export function now(): Date {
  return new Date(Date.now() + clockOffsetMs());
}

export function setClockOffset(ms: number) {
  if (!testMode()) throw new Error("test mode only");
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify({ offsetMs: ms }));
}

export function isTestMode() {
  return testMode();
}
