import { dayView } from "@/lib/server/day-view";
import { reviewRate, today } from "@/lib/server/session";
import type { RatingName } from "@/lib/srs/scheduler";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { wordId?: number; rating?: string };
  const rating = body.rating as RatingName;
  if (!body.wordId || !["again", "hard", "good", "easy"].includes(rating))
    return Response.json({ error: "wordId and rating required" }, { status: 400 });
  return Response.json(dayView(reviewRate(today(), Number(body.wordId), rating)));
}
