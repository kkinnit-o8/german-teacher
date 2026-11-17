import { dayView } from "@/lib/server/day-view";
import { startLearn, today } from "@/lib/server/session";

export async function POST() {
  return Response.json(dayView(startLearn(today())));
}
