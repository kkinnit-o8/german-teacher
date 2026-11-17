"use client";

import { useEffect, useState } from "react";
import { useAppState } from "@/components/app-state";
import { IconCheck, IconPlus } from "@/components/icons";

export function WordActions({ wordId }: { wordId: number }) {
  const { learned } = useAppState();
  const [queued, setQueued] = useState<boolean | null>(null);
  useEffect(() => {
    fetch(`/api/lookup?wid=${wordId}`)
      .then((r) => r.json())
      .then((d) => setQueued(Boolean(d.queued)))
      .catch(() => setQueued(false));
  }, [wordId]);
  if (learned.has(wordId))
    return (
      <span className="chip !text-good">
        <IconCheck size={14} /> learned
      </span>
    );
  if (queued)
    return (
      <span className="chip !text-accent">
        <IconCheck size={14} /> in your learning queue
      </span>
    );
  return (
    <button
      className="btn btn-sm btn-primary"
      disabled={queued === null}
      onClick={async () => {
        const r = await fetch("/api/queue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wid: wordId, source: "word-page" }),
        });
        if (r.ok) setQueued(true);
      }}
    >
      <IconPlus size={16} /> Add to my learning queue
    </button>
  );
}
