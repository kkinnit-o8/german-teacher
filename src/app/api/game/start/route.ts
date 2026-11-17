import { errorMessage } from "@/lib/server/chat";
import { startGame } from "@/lib/server/game";
import { getDb } from "@/lib/server/db";
import { gameView } from "@/lib/server/game";

/** Start or resume a mission. {missionId, fresh?: boolean} */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { missionId?: string; fresh?: boolean };
  if (!body.missionId) return Response.json({ error: { message: "missionId required", kind: "bad" } }, { status: 400 });
  try {
    return Response.json({ game: await startGame(body.missionId, Boolean(body.fresh)) });
  } catch (e) {
    const row = getDb()
      .prepare("SELECT id FROM game_sessions WHERE mission_id = ? AND finished = 0 ORDER BY id DESC")
      .get(body.missionId) as { id: number } | undefined;
    return Response.json({ game: row ? gameView(row.id) : null, error: errorMessage(e) }, { status: 502 });
  }
}
