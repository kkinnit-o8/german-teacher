"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { DayView } from "@/lib/server/day-view";
import type { Question } from "@/lib/srs/quiz";
import { postJson } from "@/lib/client/api";
import { checkTyped } from "@/lib/srs/answers";
import { useAppState } from "@/components/app-state";
import { useSpeech } from "@/components/use-speech";
import { NEXT_STEP, StepHeader } from "@/components/session/step-header";
import { UmlautInput } from "@/components/session/umlaut-input";
import { IconArrowRight, IconCheck, IconSpeaker, IconX } from "@/components/icons";
import { genderClass } from "@/lib/words/format";

const ART_CLASS: Record<string, string> = { der: "g-m", die: "g-f", das: "g-n" };

function promptLabel(q: Question): string {
  switch (q.kind) {
    case "de2en":
      return "What does this mean?";
    case "audio2de":
      return "Listen. Which word is it?";
    case "en2de_mc":
      return "Which German word means this?";
    case "en2de":
      return "Type the German word";
    case "gender":
      return "der, die or das?";
  }
}

export function QuizStep() {
  const { hydrated, device } = useAppState();
  const { speak } = useSpeech();
  const [view, setView] = useState<DayView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [answered, setAnswered] = useState<null | { q: Question; correct: boolean; given: string; note?: string }>(null);
  const [busy, setBusy] = useState(false);
  const lastSpoken = useRef<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    postJson<DayView>("/api/day/quiz", { silent: device.silent })
      .then(setView)
      .catch((e) => setError(e.message));
    // start once per page load, after the device settings are known
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const quiz = view?.state.quiz;
  const qid = quiz?.queue[0];
  const q = answered?.q ?? quiz?.questions.find((x) => x.id === qid);

  // play the audio question automatically
  useEffect(() => {
    if (q?.kind === "audio2de" && q.audio && !answered && lastSpoken.current !== q.id + (quiz?.answers.length ?? 0)) {
      lastSpoken.current = q.id + (quiz?.answers.length ?? 0);
      speak(q.audio);
    }
  }, [q, answered, quiz?.answers.length, speak]);

  if (error) return <p className="text-bad">{error}</p>;
  if (!view || !quiz) return <p className="text-muted">Loading…</p>;
  const total = quiz.questions.length;
  const firstTry = new Map<string, boolean>();
  for (const a of quiz.answers) if (!firstTry.has(a.qid)) firstTry.set(a.qid, a.correct);
  const doneCount = quiz.questions.filter((x) => !quiz.queue.includes(x.id)).length;

  if (!q) {
    const score = view.score ?? { correct: 0, total: 0 };
    return (
      <div className="space-y-4">
        <StepHeader step={3} title="Quick check" done={total} total={total} />
        <div className="card space-y-4 p-6 text-center" data-testid="quiz-done">
          {total ? (
            <>
              <p className="text-xl font-semibold">
                Score: {score.correct} / {score.total}
              </p>
              <p className="text-muted">Questions you got wrong were asked again and go back into your reviews.</p>
            </>
          ) : (
            <p>No quiz today: you haven’t learned new words yet.</p>
          )}
          <Link href={NEXT_STEP.quiz.href} className="btn btn-primary" data-testid="next-step">
            {NEXT_STEP.quiz.label} <IconArrowRight size={18} />
          </Link>
        </div>
      </div>
    );
  }

  const word = view.words[q.wordId];
  const submit = async (given: string) => {
    if (busy || answered) return;
    let correct: boolean;
    let note: string | undefined;
    if (q.kind === "en2de" && q.target) {
      const r = checkTyped(given, q.target);
      correct = r.ok;
      if (!r.ok) note = r.reason === "article" ? "Right word, wrong article." : undefined;
    } else correct = given === q.answer;
    setBusy(true);
    try {
      const v = await postJson<DayView>("/api/day/quiz/answer", { qid: q.id, correct, given });
      setAnswered({ q, correct, given, note });
      setView(v);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const next = () => {
    setAnswered(null);
    setTyped("");
  };
  const isRepeat = quiz.answers.some((a) => a.qid === q.id) && !answered;

  return (
    <div className="space-y-4">
      <StepHeader step={3} title="Quick check" done={doneCount} total={total} subtitle={`${quiz.queue.length} left`} />
      <article className="card space-y-6 p-5 sm:p-8" data-testid="quiz-card" data-kind={q.kind}>
        {isRepeat && <p className="text-center text-sm text-warn">Second try for this one.</p>}
        <p className="text-center text-muted">{promptLabel(q)}</p>
        <div className="text-center">
          {q.kind === "audio2de" ? (
            <button className="btn btn-primary" onClick={() => speak(q.audio!)} aria-label="Play the word again">
              <IconSpeaker /> Play again
            </button>
          ) : q.kind === "gender" ? (
            <p className="text-5xl font-bold" lang="de">
              {q.prompt}
            </p>
          ) : (
            <p
              className={`text-4xl font-bold ${q.kind === "de2en" ? genderClass(word?.noun?.gender) : ""}`}
              lang={q.kind === "de2en" ? "de" : "en"}
              data-testid="quiz-prompt"
            >
              {q.prompt}
            </p>
          )}
        </div>

        {q.options ? (
          <div className={`grid gap-2 ${q.kind === "gender" ? "grid-cols-3" : "sm:grid-cols-2"}`}>
            {q.options.map((o) => {
              const isAnswer = answered && o === q.answer;
              const isWrongPick = answered && !answered.correct && o === answered.given;
              return (
                <button
                  key={o}
                  className={`btn min-h-14 text-lg ${q.kind === "gender" ? ART_CLASS[o] : ""} ${
                    isAnswer ? "border-good! bg-good/20! text-good! font-semibold" : isWrongPick ? "border-bad! bg-bad/20! text-bad!" : ""
                  }`}
                  onClick={() => submit(o)}
                  disabled={busy || Boolean(answered)}
                  lang={q.kind === "de2en" ? "en" : "de"}
                  data-testid="quiz-option"
                >
                  {o}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mx-auto max-w-md">
            <UmlautInput
              value={typed}
              onChange={setTyped}
              onEnter={() => (answered ? next() : typed.trim() && submit(typed))}
              label="Your answer"
              disabled={busy || Boolean(answered)}
              autoFocus
              testId="quiz-input"
            />
            {!answered && (
              <button className="btn btn-primary mt-3" onClick={() => submit(typed)} disabled={!typed.trim() || busy}>
                Check
              </button>
            )}
          </div>
        )}

        {answered && (
          <div className="space-y-3 text-center" role="status" data-testid="quiz-feedback">
            {answered.correct ? (
              <p className="text-xl font-semibold text-good">
                <IconCheck className="inline" /> Correct
              </p>
            ) : (
              <p className="text-xl font-semibold text-bad">
                <IconX className="inline" /> {answered.note ?? "Not quite."} The answer is{" "}
                <span lang="de">“{q.kind === "gender" ? `${q.answer} ${q.prompt}` : q.answer}”</span>.
              </p>
            )}
            {word && q.kind !== "de2en" && <p className="text-muted">{word.display} = {word.meanings[0]}</p>}
            {!answered.correct && <p className="text-sm text-muted">It comes back at the end of the quiz.</p>}
            <button className="btn btn-primary" onClick={next} autoFocus data-testid="quiz-next">
              Next <IconArrowRight size={18} />
            </button>
          </div>
        )}
      </article>
    </div>
  );
}
