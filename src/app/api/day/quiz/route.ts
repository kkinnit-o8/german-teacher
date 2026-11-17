import { dayView } from "@/lib/server/day-view";
import { startQuiz, today } from "@/lib/server/session";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { silent?: boolean };
  return Response.json(dayView(startQuiz(today(), Boolean(body.silent))));
}
