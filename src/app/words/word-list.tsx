"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { useAppState } from "@/components/app-state";
import { POS_LABEL, genderClass, normalizeAnswer } from "@/lib/words/format";
import type { Gender, Pos } from "@/lib/dict/types";

export interface WordRow {
  id: number;
  display: string;
  lemma: string;
  pos: Pos;
  meaning: string;
  cefr: string;
  rank: number;
  gender: Gender | null;
  custom: boolean;
}

const PAGE = 100;

export function WordList({ rows }: { rows: WordRow[] }) {
  const { learned } = useAppState();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "learned" | "new">("all");
  const [cefr, setCefr] = useState("");
  const [pos, setPos] = useState("");
  const [gender, setGender] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const dq = useDeferredValue(q);

  const posOptions = useMemo(() => [...new Set(rows.map((r) => r.pos))].sort(), [rows]);
  const filtered = useMemo(() => {
    const nq = normalizeAnswer(dq);
    return rows.filter((r) => {
      if (status === "learned" && !learned.has(r.id)) return false;
      if (status === "new" && learned.has(r.id)) return false;
      if (cefr && r.cefr !== cefr) return false;
      if (pos && r.pos !== pos) return false;
      if (gender && r.gender !== gender) return false;
      if (nq && !normalizeAnswer(r.display).includes(nq) && !r.meaning.toLowerCase().includes(dq.toLowerCase()))
        return false;
      return true;
    });
  }, [rows, dq, status, cefr, pos, gender, learned]);

  return (
    <div className="space-y-3">
      <div className="card space-y-3 p-3">
        <input
          className="input"
          type="search"
          placeholder="Search German or English…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setLimit(PAGE);
          }}
          aria-label="Search words"
        />
        <div className="flex flex-wrap gap-2 text-sm">
          <select className="input !w-auto" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Learned filter">
            <option value="all">All words</option>
            <option value="learned">Learned</option>
            <option value="new">Not learned</option>
          </select>
          <select className="input !w-auto" value={cefr} onChange={(e) => setCefr(e.target.value)} aria-label="Level">
            <option value="">All levels</option>
            <option>A1</option>
            <option>A2</option>
            <option>B1</option>
          </select>
          <select className="input !w-auto" value={pos} onChange={(e) => setPos(e.target.value)} aria-label="Part of speech">
            <option value="">All word types</option>
            {posOptions.map((p) => (
              <option key={p} value={p}>
                {POS_LABEL[p]}
              </option>
            ))}
          </select>
          <select className="input !w-auto" value={gender} onChange={(e) => setGender(e.target.value)} aria-label="Gender">
            <option value="">Any gender</option>
            <option value="m">der (masculine)</option>
            <option value="f">die (feminine)</option>
            <option value="n">das (neuter)</option>
            <option value="pl">plural only</option>
          </select>
        </div>
        <p className="text-sm text-muted">
          {filtered.length} of {rows.length} words · {learned.size} learned
        </p>
      </div>
      <ul className="card divide-y divide-border">
        {filtered.slice(0, limit).map((r) => (
          <li key={r.id}>
            <Link href={`/words/${r.id}`} className="flex items-baseline gap-3 px-4 py-2.5 hover:bg-surface-2">
              <span className="w-10 shrink-0 text-right text-xs text-muted tabular-nums">{r.custom ? "+" : r.rank}</span>
              <span className={`font-semibold ${genderClass(r.gender)}`}>{r.display}</span>
              <span className="min-w-0 flex-1 truncate text-muted">{r.meaning}</span>
              {learned.has(r.id) && <span className="chip !text-good">learned</span>}
              <span className="chip">{r.cefr}</span>
            </Link>
          </li>
        ))}
        {!filtered.length && <li className="px-4 py-6 text-muted">No words match.</li>}
      </ul>
      {filtered.length > limit && (
        <button className="btn w-full" onClick={() => setLimit((l) => l + PAGE * 3)}>
          Show more
        </button>
      )}
    </div>
  );
}
