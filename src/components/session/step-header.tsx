import Link from "next/link";

export function StepHeader({
  step,
  title,
  done,
  total,
  subtitle,
}: {
  step: number;
  title: string;
  done: number;
  total: number;
  subtitle?: string;
}) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-muted">
        <Link href="/" className="hover:text-text">
          ← Today
        </Link>
        <span>
          Step {step} of 5{subtitle ? ` · ${subtitle}` : ""}
        </span>
      </div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <div
        className="h-2 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${title} progress`}
      >
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export const NEXT_STEP: Record<string, { href: string; label: string }> = {
  review: { href: "/session/learn", label: "Next: learn new words" },
  learn: { href: "/session/quiz", label: "Next: quick check" },
  quiz: { href: "/session/chat", label: "Next: conversation" },
  chat: { href: "/session/summary", label: "Next: summary" },
};
