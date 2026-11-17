import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { getWord } from "@/lib/server/words";
import { entriesByLemma } from "@/lib/server/dictionary-db";
import { analyzeText } from "@/lib/server/analysis";
import { POS_LABEL, genderClass, pluralLabel, verbFormsLabel } from "@/lib/words/format";
import { adjTable, familyTable, nounTable, verbTables, type Table } from "@/lib/words/tables";
import { GermanText } from "@/components/german-text";
import { SpeakButton } from "@/components/speak-button";
import { WordActions } from "./word-actions";

export const metadata: Metadata = { title: "Word" };

function TableView({ t }: { t: Table }) {
  return (
    <section className="card overflow-x-auto p-4">
      <h2 className="mb-2 font-semibold">{t.title}</h2>
      <table className="w-full text-left" lang="de">
        {t.head && (
          <thead>
            <tr className="text-sm text-muted">
              {t.head.map((h, i) => (
                <th key={i} className="pr-4 pb-1 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {t.rows.map((r) => (
            <tr key={r.label} className="border-t border-border">
              <th className="py-1.5 pr-4 text-sm font-medium text-muted">{r.label}</th>
              {r.cells.map((c, i) => (
                <td key={i} className="py-1.5 pr-4">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

async function WordContent({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const word = getWord(Number(id));
  if (!word) notFound();
  const entries = entriesByLemma(word.lemma);
  const entry = entries.find((e) => e.p === word.pos) ?? entries[0] ?? null;
  const tables: Table[] = [];
  if (word.forms) tables.push(familyTable(word)!);
  else if (word.pos === "noun" && entry) tables.push(nounTable(word, entry));
  else if (word.pos === "verb" && entry) tables.push(...verbTables(word, entry));
  else if (word.pos === "adj") tables.push(adjTable(word, entry));
  const example = word.example ? analyzeText(word.example.de) : null;
  const mainForms = word.noun ? pluralLabel(word) : word.verb ? verbFormsLabel(word) : "";

  return (
    <div className="space-y-4">
      <Link href="/words" className="text-sm text-muted hover:text-text">
        ← All words
      </Link>
      <header className="card space-y-2 p-5">
        <div className="flex items-start gap-3">
          <h1 className={`flex-1 text-4xl font-bold ${genderClass(word.noun?.gender)}`} lang="de">
            {word.display}
          </h1>
          <SpeakButton text={word.noun ? `${word.noun.article} ${word.lemma}` : word.lemma} />
        </div>
        <p className="text-sm text-muted">
          {POS_LABEL[word.pos]} · {word.cefr} · {word.topic}
          {word.rank < 100000 && <> · frequency rank {word.rank}</>}
          {word.ipa && <span className="ml-2 font-mono">/{word.ipa}/</span>}
        </p>
        <p className="text-xl">{word.meanings.join("; ")}</p>
        {mainForms && (
          <p className="text-muted" lang="de">
            {mainForms}
            {word.verb?.separable && <span className="ml-2 chip">separable: {word.verb.separable}</span>}
            {word.verb?.irregular && <span className="ml-2 chip">irregular</span>}
          </p>
        )}
        <WordActions wordId={word.id} />
      </header>
      {word.example && example && (
        <section className="card space-y-1 p-5">
          <h2 className="font-semibold">Example</h2>
          <div className="flex items-start gap-2 text-xl">
            <GermanText analysis={example} as="p" className="flex-1" />
            <SpeakButton text={word.example.de} />
          </div>
          <p className="text-muted">{word.example.en}</p>
        </section>
      )}
      {tables.map((t) => (
        <TableView key={t.title} t={t} />
      ))}
    </div>
  );
}

export default function WordPage({ params }: PageProps<"/words/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <WordContent params={params} />
    </Suspense>
  );
}
