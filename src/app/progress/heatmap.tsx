"use client";

import { useState } from "react";

interface Day {
  day: string;
  level: 0 | 1 | 2;
  learned: number;
  reviews: number;
}

const LEVEL_CLASS = ["bg-surface-2", "bg-accent/40", "bg-accent"];
const LEVEL_TEXT = ["no practice", "practised", "whole session done"];

function label(d: Day) {
  const [y, m, dd] = d.day.split("-").map(Number);
  const date = new Date(y, m - 1, dd).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const parts = [LEVEL_TEXT[d.level]];
  if (d.learned) parts.push(`${d.learned} new words`);
  if (d.reviews) parts.push(`${d.reviews} reviews`);
  return `${date}: ${parts.join(", ")}`;
}

/** Streak calendar: one square per day, weeks as columns (Monday on top). */
export function Heatmap({ days }: { days: Day[] }) {
  const [hover, setHover] = useState<Day | null>(null);
  const weeks: Day[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  const months: { col: number; name: string }[] = [];
  weeks.forEach((w, i) => {
    const first = w[0];
    const [y, m, d] = first.day.split("-").map(Number);
    if (d <= 7) months.push({ col: i, name: new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "short" }) });
  });
  const active = days.filter((d) => d.level > 0).length;
  const complete = days.filter((d) => d.level === 2).length;
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto pb-1">
        <div className="inline-block">
          <div className="relative mb-1 h-4 text-xs text-muted" aria-hidden>
            {months.map((m) => (
              <span key={m.col} className="absolute" style={{ left: m.col * 16 }}>
                {m.name}
              </span>
            ))}
          </div>
          <div className="flex gap-1" role="img" aria-label={`Last ${days.length} days: ${complete} complete sessions, ${active} days with practice`}>
            {weeks.map((w, i) => (
              <div key={i} className="flex flex-col gap-1">
                {w.map((d) => (
                  <span
                    key={d.day}
                    className={`block h-3 w-3 rounded-[3px] ${LEVEL_CLASS[d.level]} ${hover?.day === d.day ? "ring-2 ring-text/50" : ""}`}
                    title={label(d)}
                    onMouseEnter={() => setHover(d)}
                    onMouseLeave={() => setHover(null)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
        <span className="min-h-4 flex-1" aria-live="polite">
          {hover
            ? label(hover)
            : `${complete} complete session${complete === 1 ? "" : "s"} · ${active} day${active === 1 ? "" : "s"} with practice`}
        </span>
        {LEVEL_TEXT.map((t, i) => (
          <span key={t} className="flex items-center gap-1">
            <span className={`inline-block h-3 w-3 rounded-[3px] ${LEVEL_CLASS[i]}`} /> {t}
          </span>
        ))}
      </div>
    </div>
  );
}
