import { dayView } from "@/lib/server/day-view";
import { setStep, today, STEPS, type StepName, type StepStatus } from "@/lib/server/session";

/** Mark a step done or skipped (conversation and summary are completed by the client). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { step?: string; status?: string };
  if (!STEPS.includes(body.step as StepName) || !["done", "skipped", "todo"].includes(body.status ?? ""))
    return Response.json({ error: "bad step" }, { status: 400 });
  return Response.json(dayView(setStep(today(), body.step as StepName, body.status as StepStatus)));
}
