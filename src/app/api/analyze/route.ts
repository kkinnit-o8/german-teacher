import { analyzeMany } from "@/lib/server/analysis";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { texts?: unknown; formal?: boolean };
  const texts = Array.isArray(body.texts) ? body.texts.filter((t): t is string => typeof t === "string").slice(0, 50) : [];
  return Response.json({ analyses: analyzeMany(texts.map((t) => t.slice(0, 4000)), { formal: Boolean(body.formal) }) });
}
