import { errorMessage } from "@/lib/server/chat";
import { gameView, playerSay } from "@/lib/server/game";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { id?: number; text?: string };
  const id = Number(body.id);
  const text = String(body.text ?? "").trim();
  if (!id || !text) return Response.json({ error: { message: "id and text required", kind: "bad" } }, { status: 400 });
  try {
    return Response.json({ game: await playerSay(id, text) });
  } catch (e) {
    return Response.json({ game: gameView(id), error: errorMessage(e) }, { status: 502 });
  }
}
