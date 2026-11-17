"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ConversationView } from "@/lib/server/chat";
import { ChatView, type ChatError } from "@/components/chat/chat-view";
import { TopicPicker } from "@/components/chat/topic-picker";
import { StepHeader } from "@/components/session/step-header";

/** No internet or no key today: skip the conversation (the day then doesn't count for the streak). */
function SkipChat() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  if (!confirming)
    return (
      <button className="btn btn-ghost btn-sm text-muted" onClick={() => setConfirming(true)}>
        Can’t chat today?
      </button>
    );
  return (
    <div className="card space-y-2 p-4 text-sm">
      <p>You can skip the conversation today, but then today won’t count for your streak.</p>
      <button
        className="btn btn-sm"
        onClick={async () => {
          await fetch("/api/day/step", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ step: "chat", status: "skipped" }),
          });
          router.push("/session/summary");
        }}
      >
        Skip the conversation today
      </button>
    </div>
  );
}

export function DailyChat() {
  const [conv, setConv] = useState<ConversationView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const [justStarted, setJustStarted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const day = await (await fetch("/api/day")).json();
        const id = day.state?.chat?.conversationId;
        if (id) {
          const j = await (await fetch(`/api/chat/${id}`)).json();
          if (j.conversation?.messages?.length) setConv(j.conversation);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const start = async (topic?: string) => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/chat/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "daily", topic }),
      });
      const j = (await r.json()) as { conversation?: ConversationView; error?: ChatError };
      if (j.error) setError(j.error);
      if (j.conversation?.messages.length) {
        setJustStarted(true);
        setConv(j.conversation);
      }
    } catch {
      setError({ message: "The app's server did not answer.", kind: "network" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <StepHeader
        step={4}
        title="Conversation"
        done={conv ? Math.min(conv.exchanges, conv.target) : 0}
        total={conv?.target ?? 10}
        subtitle={conv ? `${Math.min(conv.exchanges, conv.target)} of ${conv.target} exchanges` : undefined}
      />
      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : conv ? (
        <ChatView conversation={conv} onChange={setConv} justStarted={justStarted} />
      ) : (
        <>
          <p className="text-muted">
            Chat with your teacher in German. Words you have learned appear as plain German; new words get their meaning
            above them. Tap any word for details.
          </p>
          <TopicPicker onStart={start} busy={busy} />
          {error && (
            <div className="card border-bad/50 bg-bad/5 p-4" role="alert" data-testid="chat-error">
              <p className="whitespace-pre-wrap text-bad">{error.message}</p>
              <button className="btn btn-sm mt-3" onClick={() => start()} disabled={busy} data-testid="chat-retry">
                Try again
              </button>
            </div>
          )}
          <SkipChat />
        </>
      )}
    </div>
  );
}
