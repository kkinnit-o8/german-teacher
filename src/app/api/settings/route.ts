import { connection } from "next/server";
import { getSettings, saveSettings } from "@/lib/server/settings";

export async function GET() {
  await connection();
  return Response.json(getSettings());
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return Response.json(saveSettings(body ?? {}));
}
