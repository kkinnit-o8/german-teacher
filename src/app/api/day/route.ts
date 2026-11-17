import { connection } from "next/server";
import { dayView } from "@/lib/server/day-view";

export async function GET() {
  await connection();
  return Response.json(dayView());
}
