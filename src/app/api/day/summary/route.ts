import { connection } from "next/server";
import { daySummary } from "@/lib/server/summary";
import { today } from "@/lib/server/session";

export async function GET() {
  await connection();
  return Response.json(daySummary(today(), false));
}

/** Opening the summary finishes the day (if every other step is done). */
export async function POST() {
  return Response.json(daySummary(today(), true));
}
