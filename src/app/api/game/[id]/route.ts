import { connection } from "next/server";
import { gameView } from "@/lib/server/game";

export async function GET(_req: Request, ctx: RouteContext<"/api/game/[id]">) {
  await connection();
  const { id } = await ctx.params;
  try {
    return Response.json({ game: gameView(Number(id)) });
  } catch {
    return Response.json({ error: "not found" }, { status: 404 });
  }
}
