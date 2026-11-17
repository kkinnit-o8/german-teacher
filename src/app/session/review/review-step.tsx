"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { DayView } from "@/lib/server/day-view";
import type { RatingName } from "@/lib/srs/scheduler";
import { postJson } from "@/lib/client/api";
import { NEXT_STEP, StepHeader } from "@/components/session/step-header";
import { WordDetails, WordHeadline } from "@/components/session/word-card";
import { IconArrowRight, IconCheck } from "@/components/icons";

const RATINGS: { r: RatingName; label: string; cls: string; key: string }[] = [
  { r: "again", label: "Again", cls: "border-bad text-bad", key: "1" },
  { r: "hard", label: "Hard", cls: "border-warn text-warn", key: "2" },
  { r: "good", label: "Good", cls: "border-good text-good", key: "3" },
  { r: "easy", label: "Easy", cls: "border-accent text-accent", key: "4" },
];

const interval = (d: number) => (d < 1 ? "<1 day" : d === 1 ? "1 day" : d < 31 ? `${d} days` : d < 365 ? `${Math.round(d / 30)} mo` : `${(d / 365).toFixed(1)} yr`);

export function ReviewStep() {
  const [view, setView] = useState<DayView | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    postJson<DayView>("/api/day/review")
      .then(setView)
      .catch((e) => setError(e.message));
  }, []);

  const review = view?.state.review;
  const currentId = review?.queue[0];
  const word = currentId !== undefined ? view?.words[currentId] : undefined;

  const rate = useCallback(
    async (r: RatingName) => {
      if (!word || busy) return;
      setBusy(true);
      try {
        setView(await postJson<DayView>("/api/day/review/rate", { wordId: word.id, rating: r }));
        setRevealed(false);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [word, busy],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed) {
        const r = RATINGS.find((x) => x.key === e.key);
        if (r) rate(r.r);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, rate]);

  if (error) return <p className="text-bad">{error}</p>;
  if (!view || !review) return <p className="text-muted">Loading…</p>;
  const total = review.ids.length;

  if (!word) {
    return (
      <div className="space-y-4">
        <StepHeader step={1} title="Review" done={review.done.length} total={total} />
        <div className="card space-y-4 p-6 text-center">
          <p className="text-xl font-semibold">
            {total ? (
              <>
                <IconCheck className="inline text-good" /> {total} words reviewed
              </>
            ) : (
              "Nothing to review today."
            )}
          </p>
          <Link href={NEXT_STEP.review.href} className="btn btn-primary" data-testid="next-step">
            {NEXT_STEP.review.label} <IconArrowRight size={18} />
          </Link>
        </div>
      </div>
    );
  }

  const repeat = review.done.length + review.queue.length > total || (review.ratings[word.id]?.length ?? 0) > 0;
  return (
    <div className="space-y-4">
      <StepHeader step={1} title="Review" done={review.done.length} total={total} subtitle={`${review.queue.length} left`} />
      <article className="card space-y-6 p-5 sm:p-8" data-testid="review-card">
        {repeat && <p className="text-center text-sm text-warn">Once more: this word came back after “Again”.</p>}
        <WordHeadline word={word} />
        {!revealed ? (
          <div className="flex justify-center">
            <button className="btn btn-primary min-w-48" onClick={() => setRevealed(true)} data-testid="reveal">
              Show answer
            </button>
          </div>
        ) : (
          <>
            <WordDetails word={word} />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {RATINGS.map(({ r, label, cls }) => (
                <button
                  key={r}
                  className={`btn flex-col !gap-0 border-2 ${cls}`}
                  onClick={() => rate(r)}
                  disabled={busy}
                  data-testid={`rate-${r}`}
                >
                  <span>{label}</span>
                  {view.preview && <span className="text-xs font-normal text-muted">{interval(view.preview[r])}</span>}
                </button>
              ))}
            </div>
            <p className="text-center text-xs text-muted">Keys: space to reveal, 1–4 to rate.</p>
          </>
        )}
      </article>
    </div>
  );
}
