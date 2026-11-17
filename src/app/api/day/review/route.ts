import { dayView } from "@/lib/server/day-view";
import { startReview, today } from "@/lib/server/session";

/** Start (or resume) today's review step. */
export async function POST() {
  return Response.json(dayView(startReview(today())));
}
