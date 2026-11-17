"use client";

import { useState } from "react";
import { TOPICS } from "@/lib/teacher/prompt";

/** Pick a topic or leave it to chance. */
export function TopicPicker({
  onStart,
  busy,
  label = "Start the conversation",
}: {
  onStart: (topic?: string) => void;
  busy?: boolean;
  label?: string;
}) {
  const [topic, setTopic] = useState<string | undefined>(undefined);
  return (
    <div className="card space-y-4 p-5">
      <p className="font-semibold">Topic</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Conversation topic">
        <button
          className={`btn btn-sm ${topic === undefined ? "btn-primary" : ""}`}
          role="radio"
          aria-checked={topic === undefined}
          onClick={() => setTopic(undefined)}
        >
          Surprise me
        </button>
        {TOPICS.map((t) => (
          <button
            key={t.id}
            className={`btn btn-sm ${topic === t.id ? "btn-primary" : ""}`}
            role="radio"
            aria-checked={topic === t.id}
            onClick={() => setTopic(t.id)}
          >
            {t.en}
          </button>
        ))}
      </div>
      <button className="btn btn-primary" onClick={() => onStart(topic)} disabled={busy} data-testid="start-chat">
        {busy ? "The teacher is writing…" : label}
      </button>
    </div>
  );
}
