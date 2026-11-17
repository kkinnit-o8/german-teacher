import { connection } from "next/server";
import { clockOffsetMs, isTestMode, now, setClockOffset } from "@/lib/server/clock";

/** Test mode only (GT_TEST_MODE=1): move the server clock, e.g. {"days": 1}. */
export async function POST(req: Request) {
  if (!isTestMode()) return Response.json({ error: "not available" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { days?: number; ms?: number };
  const ms = body.ms ?? (body.days ?? 0) * 86400000;
  setClockOffset(ms);
  return Response.json({ offsetMs: clockOffsetMs(), now: now().toISOString() });
}

export async function GET() {
  await connection();
  if (!isTestMode()) return Response.json({ error: "not available" }, { status: 404 });
  return Response.json({ offsetMs: clockOffsetMs(), now: now().toISOString() });
}
