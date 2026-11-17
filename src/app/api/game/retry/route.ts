import { errorMessage } from "@/lib/server/chat";
import { gameView, retryGame } from "@/lib/server/game";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { id?: number };
  const id = Number(body.id);
  try {
    return Response.json({ game: await retryGame(id) });
  } catch (e) {
    return Response.json({ game: gameView(id), error: errorMessage(e) }, { status: 502 });
  }
}
