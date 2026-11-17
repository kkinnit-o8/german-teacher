import { connection } from "next/server";
import { getConversation } from "@/lib/server/chat";

export async function GET(_req: Request, ctx: RouteContext<"/api/chat/[id]">) {
  await connection();
  const { id } = await ctx.params;
  const conv = getConversation(Number(id));
  if (!conv) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ conversation: conv });
}
