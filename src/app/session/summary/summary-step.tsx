"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DaySummary } from "@/lib/server/summary";
import { postJson } from "@/lib/client/api";
import { StepHeader } from "@/components/session/step-header";
import { GermanTextAuto } from "@/components/german-text";
import { IconCheck, IconFlame, IconPlus } from "@/components/icons";
import { genderClass } from "@/lib/words/format";

const STEP_LINKS: Record<string, { href: string; title: string }> = {
  review: { href: "/session/review", title: "Review" },
  learn: { href: "/session/learn", title: "Learn" },
  quiz: { href: "/session/quiz", title: "Quick check" },
  chat: { href: "/session/chat", title: "Conversation" },
};

export function SummaryStep() {
  const [s, setS] = useState<DaySummary | null>(null);
  const [queued, setQueued] = useState<Set<string>>(new Set());
  useEffect(() => {
    postJson<DaySummary>("/api/day/summary").then(setS);
  }, []);
  if (!s) return <p className="text-muted">Loading…</p>;

  if (!s.ready) {
    const missing = Object.entries(STEP_LINKS).filter(([k]) => s.state.steps[k as keyof typeof s.state.steps] === "todo");
    return (
      <div className="space-y-4">
        <StepHeader step={5} title="Summary" done={0} total={1} />
        <div className="card space-y-3 p-5">
          <p>Finish the other steps first:</p>
          <div className="flex flex-wrap gap-2">
            {missing.map(([k, v]) => (
              <Link key={k} href={v.href} className="btn btn-primary">
                {v.title}
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const usedTeacher = s.learned.filter((w) => w.usedByTeacher).length;
  const usedMe = s.learned.filter((w) => w.usedByMe).length;
  return (
    <div className="space-y-4" data-testid="summary">
      <StepHeader step={5} title="Summary" done={1} total={1} />
      <div className="card flex flex-wrap items-center gap-4 p-5">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-warn/15 text-warn">
          <IconFlame size={30} />
        </span>
        <div className="flex-1">
          <p className="text-2xl font-bold" data-testid="streak">
            {s.streak.current} day streak
          </p>
          <p className="text-muted">
            {s.justCompleted ? "Today is complete. Well done!" : s.streak.completedToday ? "Today is complete." : ""}
            {s.streak.best > s.streak.current ? ` Your best: ${s.streak.best} days.` : ""}
          </p>
        </div>
        <Link href="/" className="btn">
          Back to Today
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold">{s.learned.length}</p>
          <p className="text-sm text-muted">new words</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold" data-testid="summary-quiz">
            {s.quiz.correct}/{s.quiz.total}
          </p>
          <p className="text-sm text-muted">quick check</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold">{s.exchanges}</p>
          <p className="text-sm text-muted">
            chat exchanges{s.cost > 0 ? ` · ≈ $${s.cost.toFixed(4)}` : ""}
          </p>
        </div>
      </div>

      {s.learned.length > 0 && (
        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">Today’s words</h2>
          <p className="text-sm text-muted">
            The teacher used {usedTeacher} of them; you used {usedMe}.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {s.learned.map((w) => (
              <li key={w.id} className="flex items-center gap-2">
                <span className={`font-semibold ${genderClass(w.gender as never)}`} lang="de">
                  {w.display}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-muted">{w.meaning}</span>
                {w.usedByTeacher && <span className="chip" title="The teacher used this word">teacher</span>}
                {w.usedByMe && <span className="chip !text-good" title="You used this word">you</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {s.corrections.length > 0 && (
        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">The teacher’s corrections</h2>
          <ul className="space-y-3">
            {s.corrections.map((c, i) => (
              <li key={i} className="space-y-1 border-l-4 border-warn/60 pl-3">
                <p className="text-muted line-through decoration-bad/60" lang="de">
                  {c.said}
                </p>
                {c.correction.corrected && <GermanTextAuto text={c.correction.corrected} as="p" className="text-lg" />}
                <p className="text-sm">{c.correction.explanation}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {s.chatWords.length > 0 && (
        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">New words from the chat</h2>
          <ul className="space-y-2">
            {s.chatWords.map((w) => (
              <li key={w.key} className="flex items-center gap-2">
                <span className="font-semibold" lang="de">
                  {w.lemma}
                </span>
                <span className="flex-1 text-sm text-muted">{w.gloss}</span>
                {queued.has(w.key) ? (
                  <span className="chip !text-good">
                    <IconCheck size={14} /> tomorrow
                  </span>
                ) : (
                  <button
                    className="btn btn-sm"
                    onClick={async () => {
                      await postJson("/api/queue", w.wordId ? { wid: w.wordId, source: "chat" } : { dict: w.dictId, source: "chat" });
                      setQueued((q) => new Set(q).add(w.key));
                    }}
                  >
                    <IconPlus size={14} /> Learn tomorrow
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
