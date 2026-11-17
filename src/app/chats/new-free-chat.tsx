"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TopicPicker } from "@/components/chat/topic-picker";

/** Start an extra conversation outside the daily routine. */
export function NewFreeChat() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open)
    return (
      <button className="btn btn-sm ml-auto" onClick={() => setOpen(true)}>
        New free chat
      </button>
    );
  return (
    <div className="w-full space-y-2">
      <TopicPicker
        busy={busy}
        label="Start a free chat"
        onStart={async (topic) => {
          setBusy(true);
          setError(null);
          const r = await fetch("/api/chat/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind: "free", topic }),
          });
          const j = await r.json();
          setBusy(false);
          // on an error, stay here and show it (the empty conversation is not listed)
          if (j.error) setError(j.error.message);
          else if (j.conversation?.id) router.push(`/chats/${j.conversation.id}`);
        }}
      />
      {error && <p className="whitespace-pre-wrap text-bad">{error}</p>}
    </div>
  );
}
