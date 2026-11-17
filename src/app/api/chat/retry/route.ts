import { errorMessage, getConversation, teacherTurn } from "@/lib/server/chat";

/** Ask for the teacher's reply again after a failed request. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { id?: number };
  const id = Number(body.id);
  const conv = id ? getConversation(id) : null;
  if (!conv) return Response.json({ error: { message: "Conversation not found", kind: "not-found" } }, { status: 404 });
  if (!conv.pending && conv.messages.length > 0) return Response.json({ conversation: conv });
  try {
    return Response.json({ conversation: await teacherTurn(id) });
  } catch (e) {
    return Response.json({ conversation: getConversation(id), error: errorMessage(e) }, { status: 502 });
  }
}
