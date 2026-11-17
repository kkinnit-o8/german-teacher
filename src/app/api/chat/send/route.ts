import { addUserMessage, errorMessage, getConversation, teacherTurn } from "@/lib/server/chat";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { id?: number; text?: string };
  const id = Number(body.id);
  const text = String(body.text ?? "").trim();
  const conv = id ? getConversation(id) : null;
  if (!conv) return Response.json({ error: { message: "Conversation not found", kind: "not-found" } }, { status: 404 });
  if (!text) return Response.json({ error: { message: "Empty message", kind: "empty" } }, { status: 400 });
  if (conv.pending) return Response.json({ conversation: conv, error: { message: "Waiting for the teacher's reply.", kind: "pending" } }, { status: 409 });
  addUserMessage(id, text);
  try {
    return Response.json({ conversation: await teacherTurn(id) });
  } catch (e) {
    return Response.json({ conversation: getConversation(id), error: errorMessage(e) }, { status: 502 });
  }
}
