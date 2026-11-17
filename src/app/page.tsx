import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { dayView } from "@/lib/server/day-view";
import { completedDays, loadDay, pickNewWords, saveDay, today } from "@/lib/server/session";
import { getSettings } from "@/lib/server/settings";
import { learnedIds } from "@/lib/server/progress";
import { computeStreak } from "@/lib/srs/day";
import { IconArrowRight, IconCheck, IconFlame } from "@/components/icons";

type Status = "todo" | "done" | "skipped";

async function Steps() {
  await connection();
  const day = today();
  const s = loadDay(day);
  const view = dayView(s);
  // nothing due: the review step is skipped automatically
  if (!s.review && view.dueCount === 0 && s.steps.review === "todo") {
    s.steps.review = "skipped";
    saveDay(s);
  }
  const settings = getSettings();
  const newCount = s.learn ? s.learn.ids.length : pickNewWords(settings.newPerDay).length;
  const streak = computeStreak(completedDays(), day);
  const learnedTotal = learnedIds().length;
  const quizScore = view.score;
  const chat = s.chat;

  const steps: { key: string; title: string; href: string; status: Status; detail: string }[] = [
    {
      key: "review",
      title: "Review",
      href: "/session/review",
      status: s.steps.review,
      detail:
        s.steps.review === "skipped"
          ? "Nothing due today"
          : s.review
            ? `${s.review.done.length} of ${s.review.ids.length} reviewed`
            : `${Math.min(view.dueCount, settings.maxReviews)} words due`,
    },
    {
      key: "learn",
      title: "Learn",
      href: "/session/learn",
      status: s.steps.learn,
      detail: s.learn ? `${s.learn.done.length} of ${s.learn.ids.length} new words` : `${newCount} new words`,
    },
    {
      key: "quiz",
      title: "Quick check",
      href: "/session/quiz",
      status: s.steps.quiz,
      detail: quizScore && s.steps.quiz === "done" ? `Score ${quizScore.correct}/${quizScore.total}` : "A short quiz on today’s words",
    },
    {
      key: "chat",
      title: "Conversation",
      href: "/session/chat",
      status: s.steps.chat,
      detail: chat ? `${Math.min(chat.exchanges, chat.target)} of ${chat.target} exchanges` : `${settings.exchangesPerDay} exchanges with your teacher`,
    },
    {
      key: "summary",
      title: "Summary",
      href: "/session/summary",
      status: s.steps.summary,
      detail: "What you did today",
    },
  ];
  const current = steps.find((x) => x.status === "todo");
  const doneCount = steps.filter((x) => x.status !== "todo").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="chip !text-base" title="Days in a row with the whole session done">
          <IconFlame size={18} className="text-warn" /> {streak.current} day streak
        </span>
        <span className="chip !text-base">{learnedTotal} words learned</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-label={`${doneCount} of 5 steps done`}>
        <div className="h-full rounded-full bg-accent" style={{ width: `${(doneCount / 5) * 100}%` }} />
      </div>
      <ol className="space-y-3" data-testid="today-steps">
        {steps.map((st, i) => {
          const isCurrent = current?.key === st.key;
          const finished = st.status !== "todo";
          return (
            <li key={st.key}>
              <Link
                href={st.href}
                className={`card flex items-center gap-4 p-4 transition-colors hover:bg-surface-2 ${
                  isCurrent ? "!border-accent ring-2 ring-accent/30" : ""
                }`}
                data-testid={`step-${st.key}`}
                data-status={st.status}
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg font-bold ${
                    finished ? "bg-good/15 text-good" : isCurrent ? "bg-accent text-accent-text" : "bg-surface-2 text-muted"
                  }`}
                >
                  {finished ? <IconCheck size={20} /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-semibold">{st.title}</span>
                  <span className="block text-sm text-muted">{st.detail}</span>
                </span>
                {isCurrent && (
                  <span className="btn btn-primary btn-sm">
                    {s.startedAt !== s.updatedAt ? "Continue" : "Start"} <IconArrowRight size={16} />
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
      {!current && (
        <div className="card p-5 text-center">
          <p className="text-lg font-semibold">All done for today. Bis morgen!</p>
          <p className="text-muted">The next session starts at 04:00.</p>
        </div>
      )}
    </div>
  );
}

export default function TodayPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Today</h1>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Steps />
      </Suspense>
    </div>
  );
}
