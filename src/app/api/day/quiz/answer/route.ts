import { dayView } from "@/lib/server/day-view";
import { quizAnswer, today } from "@/lib/server/session";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { qid?: string; correct?: boolean; given?: string };
  if (!body.qid) return Response.json({ error: "qid required" }, { status: 400 });
  return Response.json(dayView(quizAnswer(today(), body.qid, Boolean(body.correct), String(body.given ?? ""))));
}
