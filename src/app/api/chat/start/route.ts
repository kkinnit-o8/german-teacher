import { createConversation, errorMessage, getConversation, startDailyConversation, teacherTurn } from "@/lib/server/chat";

/** Start (or resume) a conversation. {kind: "daily" | "free", topic?: string} */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { kind?: string; topic?: string };
  const id = body.kind === "free" ? createConversation("free", body.topic) : startDailyConversation(body.topic);
  const conv = getConversation(id)!;
  if (conv.messages.length > 0) return Response.json({ conversation: conv });
  try {
    return Response.json({ conversation: await teacherTurn(id) });
  } catch (e) {
    return Response.json({ conversation: getConversation(id), error: errorMessage(e) }, { status: 502 });
  }
}
