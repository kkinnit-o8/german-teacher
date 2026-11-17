import { isTestMode } from "@/lib/server/clock";

/** Test mode only: swap the OpenRouter key to test error handling. */
export async function POST(req: Request) {
  if (!isTestMode()) return Response.json({ error: "not available" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { key?: string };
  process.env.OPENROUTER_API_KEY = body.key ?? "";
  return Response.json({ ok: true });
}
