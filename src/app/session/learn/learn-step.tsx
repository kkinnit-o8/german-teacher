"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { DayView } from "@/lib/server/day-view";
import { postJson } from "@/lib/client/api";
import { checkTyped } from "@/lib/srs/answers";
import { useAppState } from "@/components/app-state";
import { NEXT_STEP, StepHeader } from "@/components/session/step-header";
import { UmlautInput } from "@/components/session/umlaut-input";
import { WordDetails, WordHeadline } from "@/components/session/word-card";
import { IconArrowRight, IconCheck } from "@/components/icons";

export function LearnStep() {
  const [view, setView] = useState<DayView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [feedback, setFeedback] = useState<null | { ok: boolean; text: string }>(null);
  const [busy, setBusy] = useState(false);
  const { addLearned } = useAppState();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    postJson<DayView>("/api/day/learn")
      .then(setView)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-bad">{error}</p>;
  if (!view) return <p className="text-muted">Loading…</p>;
  const learn = view.state.learn!;
  const currentId = learn.ids.find((id) => !learn.done.includes(id));
  const word = currentId !== undefined ? view.words[currentId] : undefined;

  if (!learn.ids.length) {
    return (
      <div className="space-y-4">
        <StepHeader step={2} title="Learn" done={0} total={0} />
        <div className="card p-6">
          <p>No new words today (the new-words setting is 0, or you have learned the whole word bank).</p>
          <Link href={NEXT_STEP.learn.href} className="btn btn-primary mt-4">
            {NEXT_STEP.learn.label}
          </Link>
        </div>
      </div>
    );
  }

  if (!word) {
    return (
      <div className="space-y-4">
        <StepHeader step={2} title="Learn" done={learn.done.length} total={learn.ids.length} />
        <div className="card space-y-4 p-6 text-center">
          <p className="text-xl font-semibold">
            <IconCheck className="inline text-good" /> {learn.done.length} new words learned
          </p>
          <p className="text-muted" lang="de">
            {learn.done.map((id) => view.words[id]?.display).join(" · ")}
          </p>
          <Link href={NEXT_STEP.learn.href} className="btn btn-primary" data-testid="next-step">
            {NEXT_STEP.learn.label} <IconArrowRight size={18} />
          </Link>
        </div>
      </div>
    );
  }

  const target = {
    lemma: word.lemma,
    article: word.noun && !word.noun.pluralOnly ? word.noun.article : undefined,
    reflexive: word.verb?.reflexive,
    // word families: the lemma ("der"), the whole display ("der, die, das") or any form counts
    alternatives: word.forms ? [word.display, word.display.replace(/\s*\(.*\)\s*/, ""), ...Object.keys(word.forms)] : undefined,
  };
  // what to copy: nouns with their article, families just the main form
  const typeThis = word.forms ? word.lemma : word.display;

  const check = () => {
    const r = checkTyped(typed, target);
    if (r.ok) setFeedback({ ok: true, text: "Correct!" });
    else
      setFeedback({
        ok: false,
        text: r.reason === "article" ? `Check the article: ${r.expected}` : `Not quite. It's “${r.expected}”. Try again.`,
      });
  };

  const next = async () => {
    setBusy(true);
    try {
      const v = await postJson<DayView>("/api/day/learn/done", { wordId: word.id });
      addLearned([word.id]);
      setView(v);
      setTyped("");
      setFeedback(null);
      requestAnimationFrame(() => inputRef.current?.focus());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <StepHeader
        step={2}
        title="Learn"
        done={learn.done.length}
        total={learn.ids.length}
        subtitle={`word ${learn.done.length + 1} of ${learn.ids.length}`}
      />
      <article className="card space-y-5 p-5 sm:p-8" data-testid="learn-card">
        <WordHeadline word={word} />
        <WordDetails word={word} />
        <div className="mx-auto max-w-md space-y-2 border-t border-border pt-5">
          <p className="font-semibold">Type it</p>
          <UmlautInput
            ref={inputRef}
            value={typed}
            onChange={(v) => {
              setTyped(v);
              if (feedback && !feedback.ok) setFeedback(null);
            }}
            onEnter={() => (feedback?.ok ? next() : check())}
            placeholder={typeThis}
            label={`Type ${typeThis}`}
            disabled={busy}
            testId="learn-input"
          />
          {feedback && (
            <p className={feedback.ok ? "text-good" : "text-bad"} role="status" data-testid="learn-feedback">
              {feedback.text}
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {feedback?.ok ? (
              <button className="btn btn-primary" onClick={next} disabled={busy} data-testid="learn-next">
                Next word <IconArrowRight size={18} />
              </button>
            ) : (
              <button className="btn btn-primary" onClick={check} disabled={!typed.trim()} data-testid="learn-check">
                Check
              </button>
            )}
            {!feedback?.ok && (
              <button className="btn btn-ghost text-sm" onClick={next} disabled={busy}>
                Skip typing
              </button>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
