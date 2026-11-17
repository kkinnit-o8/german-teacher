import { connection } from "next/server";
import { addToQueue, ensureWordForDict, queuedWords, removeFromQueue } from "@/lib/server/queue";
import { getWord } from "@/lib/server/words";

export async function GET() {
  await connection();
  return Response.json({ words: queuedWords().map((w) => ({ id: w.id, display: w.display, meaning: w.meanings[0] })) });
}

/** Queue a word for the next Learn step: {wid} for a word bank word, or {dict} for any dictionary entry. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { wid?: number; dict?: number; source?: string };
  let word = body.wid ? getWord(Number(body.wid)) : undefined;
  if (!word && body.dict) word = ensureWordForDict(Number(body.dict)) ?? undefined;
  if (!word) return Response.json({ error: "Word not found" }, { status: 404 });
  addToQueue(word.id, typeof body.source === "string" ? body.source.slice(0, 20) : "popup");
  return Response.json({ wid: word.id, queued: true });
}

export async function DELETE(req: Request) {
  const wid = Number(new URL(req.url).searchParams.get("wid"));
  if (wid) removeFromQueue(wid);
  return Response.json({ ok: true });
}
