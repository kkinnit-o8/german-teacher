import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { allWords } from "@/lib/server/words";
import { WordList, type WordRow } from "./word-list";
import { Reader } from "@/components/reader";

export const metadata: Metadata = { title: "Words" };

async function Content() {
  await connection();
  const rows: WordRow[] = allWords().map((w) => ({
    id: w.id,
    display: w.display,
    lemma: w.lemma,
    pos: w.pos,
    meaning: w.meanings.slice(0, 2).join("; "),
    cefr: w.cefr,
    rank: w.rank,
    gender: w.noun?.gender ?? null,
    custom: w.id >= 100000,
  }));
  return <WordList rows={rows} />;
}

export default function WordsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Words</h1>
      <Suspense fallback={<p className="text-muted">Loading words…</p>}>
        <Content />
      </Suspense>
      <Reader />
    </div>
  );
}
