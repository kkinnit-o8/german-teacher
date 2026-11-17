import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { progressData } from "@/lib/server/stats";
import { Heatmap } from "./heatmap";
import { CoverageInfo } from "./coverage-info";

export const metadata: Metadata = { title: "Progress" };

const pct = (x: number) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`;

function Tile({ value, label, sub, testId }: { value: string | number; label: string; sub?: string; testId?: string }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-3xl font-bold tabular-nums" data-testid={testId}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

async function Content() {
  await connection();
  const p = progressData();
  const next = p.milestones.find((m) => m.words > p.learned);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile value={p.learned} label="Words learned" sub={`of ${p.bankSize}`} testId="words-learned" />
        <Tile value={p.dueTomorrow} label="Reviews due tomorrow" />
        <Tile value={p.streak.current} label="Day streak" sub={`best ${p.streak.best}`} />
        <Tile value={pct(p.coverage)} label="Everyday text you can read" sub="estimate, see below" testId="coverage" />
      </div>

      <section className="card space-y-3 p-5">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">How much German can you read?</h2>
          <CoverageInfo />
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-sm text-muted">
            <span>{pct(p.coverage)} of the words in everyday German text</span>
            <span>whole word bank: {pct(p.coverageAll)}</span>
          </div>
          <div
            className="relative h-3 overflow-hidden rounded-full bg-surface-2"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(p.coverage * 100)}
            aria-label="Estimated coverage of everyday text"
          >
            <div className="h-full rounded-full bg-accent" style={{ width: `${p.coverage * 100}%` }} />
            <div className="absolute inset-y-0 w-0.5 bg-muted/60" style={{ left: `${p.coverageAll * 100}%` }} title="whole word bank" />
          </div>
        </div>
        {next && (
          <p className="text-sm text-muted">
            With the first {next.words} words of the word bank you would know about {pct(next.coverage)} of running text.
          </p>
        )}
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="text-lg font-semibold">Your days</h2>
        <Heatmap days={p.calendar} />
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="text-lg font-semibold">By level</h2>
        <ul className="space-y-3">
          {p.byLevel.map((l) => (
            <li key={l.level} className="grid grid-cols-[3rem_1fr_7rem] items-center gap-3">
              <span className="font-semibold">{l.level}</span>
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                <div className="h-full rounded-full bg-accent" style={{ width: `${l.total ? (l.learned / l.total) * 100 : 0}%` }} />
              </div>
              <span className="text-right text-sm tabular-nums text-muted">
                {l.learned} / {l.total}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function ProgressPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Progress</h1>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Content />
      </Suspense>
    </div>
  );
}
