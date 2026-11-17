import { dayView } from "@/lib/server/day-view";
import { learnDone, today } from "@/lib/server/session";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { wordId?: number };
  if (!body.wordId) return Response.json({ error: "wordId required" }, { status: 400 });
  return Response.json(dayView(learnDone(today(), Number(body.wordId))));
}
