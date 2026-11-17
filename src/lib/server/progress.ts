import "server-only";
import { getDb } from "./db";

export function learnedIds(): number[] {
  return (getDb().prepare("SELECT word_id FROM learned").all() as { word_id: number }[]).map((r) => r.word_id);
}
