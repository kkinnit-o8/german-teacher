import { revealHint } from "@/lib/server/game";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { id?: number };
  return Response.json({ game: revealHint(Number(body.id)) });
}
