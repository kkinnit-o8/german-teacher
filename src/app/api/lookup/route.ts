import { connection } from "next/server";
import { dictEntry } from "@/lib/server/dictionary-db";
import { getWord, wordIndex } from "@/lib/server/words";
import { isQueued } from "@/lib/server/queue";
import { getDb } from "@/lib/server/db";

/** Details for the word popup: the word bank word and/or the dictionary entry. */
export async function GET(req: Request) {
  await connection();
  const url = new URL(req.url);
  const wid = Number(url.searchParams.get("wid")) || undefined;
  const dict = Number(url.searchParams.get("dict")) || undefined;
  let word = wid ? getWord(wid) : undefined;
  const entry = dict ? dictEntry(dict) : word?.dictIds?.[0] ? dictEntry(word.dictIds[0]) : null;
  if (!word && dict) word = wordIndex().byDictId.get(dict);
  const learned = word ? Boolean(getDb().prepare("SELECT 1 FROM learned WHERE word_id = ?").get(word.id)) : false;
  return Response.json({
    word: word ?? null,
    entry: entry ?? null,
    learned,
    queued: word ? isQueued(word.id) : false,
  });
}
