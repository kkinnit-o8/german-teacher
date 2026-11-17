"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessageView, ConversationView } from "@/lib/server/chat";
import { primeAnalysis } from "@/lib/client/analysis";
import { useAppState } from "../app-state";
import { GermanText } from "../german-text";
import { useSpeech } from "../use-speech";
import { IconArrowRight, IconBulb, IconCheck, IconMic, IconPlus, IconSpeaker, IconTranslate } from "../icons";
import { MIC_HELP, useSpeechInput } from "../use-speech-input";
import { ChatInput } from "./chat-input";
import { MicButton } from "./mic-button";

export interface ChatError {
  message: string;
  kind: string;
}

interface Props {
  conversation: ConversationView;
  /** the conversation was just started: read the opening message aloud */
  justStarted?: boolean;
  /** read-only: rereading a past chat */
  readOnly?: boolean;
  onChange?: (c: ConversationView) => void;
}

function TeacherBubble({ m }: { m: ChatMessageView }) {
  const [showTr, setShowTr] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const { speak, silent } = useSpeech();

  return (
    <div className="flex justify-start" data-testid="teacher-message">
      <div className="max-w-[92%] space-y-2 sm:max-w-[80%]">
        <div className="card rounded-tl-sm px-4 py-3 text-xl">
          {m.raw ? (
            <div>
              <p className="text-xs text-warn">The reply came back in an unexpected format, shown as plain text:</p>
              <p className="whitespace-pre-wrap" lang="de">
                {m.text}
              </p>
            </div>
          ) : m.analysis ? (
            <GermanText analysis={m.analysis} as="p" />
          ) : (
            <p lang="de">{m.text}</p>
          )}
          {showTr && m.translation && (
            <p className="mt-2 border-t border-border pt-2 text-base text-muted" data-testid="translation">
              {m.translation}
            </p>
          )}
          {showHint && m.hint && (
            <div className="mt-2 border-t border-border pt-2 text-base" data-testid="hint">
              <span className="text-sm text-muted">You could say: </span>
              {m.hintAnalysis ? <GermanText analysis={m.hintAnalysis} /> : <span lang="de">{m.hint}</span>}
            </div>
          )}
        </div>
        {!m.raw && (
          <div className="flex flex-wrap gap-1">
            {m.translation && (
              <button className="btn btn-sm btn-ghost" onClick={() => setShowTr((v) => !v)} aria-pressed={showTr} data-testid="translate-btn">
                <IconTranslate size={16} /> Translate
              </button>
            )}
            {!silent && (
              <button className="btn btn-sm btn-ghost" onClick={() => speak(m.text)}>
                <IconSpeaker size={16} /> Play audio
              </button>
            )}
            {m.hint && (
              <button className="btn btn-sm btn-ghost" onClick={() => setShowHint((v) => !v)} aria-pressed={showHint} data-testid="hint-btn">
                <IconBulb size={16} /> Hint
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function UserBubble({ m }: { m: ChatMessageView }) {
  return (
    <div className="flex flex-col items-end gap-1" data-testid="user-message">
      <div className="max-w-[92%] rounded-2xl rounded-tr-sm bg-accent px-4 py-3 text-xl text-accent-text sm:max-w-[80%]" lang="de">
        {m.text}
      </div>
      {m.correction && (
        <div className="card max-w-[92%] border-warn/50 bg-warn/5 px-4 py-2 sm:max-w-[80%]" data-testid="correction">
          <p className="text-sm">
            <span className="font-semibold text-warn">Correction: </span>
            {m.correction.explanation}
          </p>
          {m.correction.corrected && (
            <div className="mt-1 text-lg">
              {m.correctionAnalysis ? <GermanText analysis={m.correctionAnalysis} as="p" /> : <p lang="de">{m.correction.corrected}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function WordsFromChat({ conversation }: { conversation: ConversationView }) {
  const [queued, setQueued] = useState<Set<string>>(new Set());
  const [queuedIds, setQueuedIds] = useState<Set<number>>(new Set());
  useEffect(() => {
    fetch("/api/queue")
      .then((r) => r.json())
      .then((d: { words: { id: number }[] }) => setQueuedIds(new Set(d.words.map((w) => w.id))))
      .catch(() => {});
  }, [conversation.words.length]);
  if (!conversation.words.length) return <p className="text-sm text-muted">New words the teacher uses will show up here.</p>;
  return (
    <ul className="space-y-2" data-testid="chat-words">
      {conversation.words.map((w) => {
        const isQueued = queued.has(w.key) || (w.wordId !== null && queuedIds.has(w.wordId));
        return (
          <li key={w.key} className="flex items-center gap-2">
            <span className="min-w-0 flex-1">
              <span className="font-semibold" lang="de">
                {w.lemma}
              </span>{" "}
              <span className="text-sm text-muted">{w.gloss}</span>
            </span>
            {isQueued ? (
              <span className="chip !text-good" title="It will be one of tomorrow's new words">
                <IconCheck size={14} /> tomorrow
              </span>
            ) : (
              <button
                className="btn btn-sm"
                title="Put it at the front of tomorrow's new words"
                onClick={async () => {
                  const r = await fetch("/api/queue", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(w.wordId ? { wid: w.wordId, source: "chat" } : { dict: w.dictId, source: "chat" }),
                  });
                  if (r.ok) setQueued((s) => new Set(s).add(w.key));
                }}
                data-testid="queue-chat-word"
              >
                <IconPlus size={14} /> Learn tomorrow
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function ChatView({ conversation, readOnly, onChange, justStarted }: Props) {
  const [conv, setConv] = useState(conversation);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const [keepChatting, setKeepChatting] = useState(conversation.exchanges > conversation.target);
  const [freshIds, setFreshIds] = useState<Set<number>>(() =>
    justStarted ? new Set(conversation.messages.filter((m) => m.role === "teacher").map((m) => m.id)) : new Set(),
  );
  const { settings, device, setDevice } = useAppState();
  const { speak, silent } = useSpeech();
  const endRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  const sendRef = useRef<(t: string) => Promise<boolean>>(async () => false);
  const speakingMode = device.speakingMode && !silent;
  const mic = useSpeechInput({
    onText: setDraft,
    // speaking mode: the message is sent as soon as you stop talking
    onFinal: (text) => {
      if (speakingMode && text.trim()) {
        setDraft("");
        sendRef.current(text);
      }
    },
  });

  const update = useCallback(
    (c: ConversationView, fresh = false) => {
      for (const m of c.messages) if (m.analysis) primeAnalysis(m.analysis);
      if (fresh) {
        const old = new Set(conv.messages.map((m) => m.id));
        setFreshIds(new Set(c.messages.filter((m) => !old.has(m.id) && m.role === "teacher").map((m) => m.id)));
      }
      setConv(c);
      onChange?.(c);
    },
    [conv.messages, onChange],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [conv.messages.length, busy, error]);

  async function call(url: string, body: unknown) {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json()) as { conversation?: ConversationView; error?: ChatError };
      if (j.conversation) update(j.conversation, true);
      if (j.error) setError(j.error);
      return !j.error;
    } catch {
      setError({ message: "The app's server did not answer. Is it still running?", kind: "network" });
      return false;
    } finally {
      setBusy(false);
    }
  }

  const send = async (text: string) => {
    // show the message right away
    setConv((c) => ({
      ...c,
      messages: [...c.messages, { id: -Date.now(), role: "user", text, createdAt: new Date().toISOString() }],
    }));
    return call("/api/chat/send", { id: conv.id, text });
  };
  const retry = () => call("/api/chat/retry", { id: conv.id });

  const targetReached = conv.exchanges >= conv.target;
  const showInput = !readOnly && (!targetReached || keepChatting || conv.kind === "free");
  useEffect(() => {
    sendRef.current = send;
  });

  // auto-speak new teacher messages; in speaking mode, open the mic afterwards
  const spokenRef = useRef<number | null>(null);
  const { start: startMic } = mic;
  useEffect(() => {
    if (readOnly || silent) return;
    const fresh = conv.messages.filter((m) => m.role === "teacher" && freshIds.has(m.id) && !m.raw);
    const last = fresh[fresh.length - 1];
    if (!last || spokenRef.current === last.id) return;
    if (!settings.autoSpeak && !speakingMode) return;
    spokenRef.current = last.id;
    speak(last.text).then(() => {
      if (speakingMode && showInput) startMic();
    });
  }, [conv.messages, freshIds, readOnly, silent, settings.autoSpeak, speakingMode, showInput, speak, startMic]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_17rem]">
      <section className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <span className="chip">{conv.topic.en}</span>
          {conv.kind === "daily" && (
            <span className="chip" data-testid="exchange-count">
              {Math.min(conv.exchanges, conv.target)} / {conv.target} exchanges
              {conv.exchanges > conv.target ? ` (+${conv.exchanges - conv.target})` : ""}
            </span>
          )}
          {conv.cost > 0 && <span className="chip" title="Approximate cost of this conversation on OpenRouter">≈ ${conv.cost.toFixed(4)}</span>}
          {!readOnly && (
            <button
              className={`btn btn-sm ml-auto ${speakingMode ? "btn-primary" : ""}`}
              onClick={() => setDevice({ speakingMode: !device.speakingMode })}
              disabled={silent || mic.availability === "insecure" || mic.availability === "unsupported"}
              aria-pressed={speakingMode}
              title={
                silent
                  ? "Speaking mode needs sound: turn off silent mode first"
                  : "Hands-free: the teacher's reply is read aloud, then the microphone opens, and your message is sent when you stop talking"
              }
              data-testid="speaking-mode"
            >
              <IconMic size={16} /> Speaking mode {speakingMode ? "on" : "off"}
            </button>
          )}
        </div>

        <div className="space-y-4" aria-live="polite">
          {conv.messages.map((m) =>
            m.role === "teacher" ? (
              <TeacherBubble key={m.id} m={m} />
            ) : (
              <UserBubble key={m.id} m={m} />
            ),
          )}
          {busy && (
            <div className="flex justify-start" aria-label="The teacher is writing">
              <div className="card flex gap-1 px-4 py-3">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}
          {error && (
            <div className="card border-bad/50 bg-bad/5 p-4" role="alert" data-testid="chat-error">
              <p className="whitespace-pre-wrap text-bad">{error.message}</p>
              {error.kind !== "empty" && (
                <button className="btn btn-sm mt-3" onClick={retry} disabled={busy} data-testid="chat-retry">
                  Try again
                </button>
              )}
            </div>
          )}
          {!error && conv.pending && !busy && !readOnly && (
            <div className="card p-4">
              <p className="text-muted">The teacher hasn’t answered your last message yet.</p>
              <button className="btn btn-sm mt-2" onClick={retry}>
                Get the answer
              </button>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {!readOnly && conv.kind === "daily" && targetReached && !keepChatting && (
          <div className="card space-y-3 p-4 text-center" data-testid="chat-complete">
            <p className="text-lg font-semibold">
              <IconCheck className="inline text-good" /> Today’s conversation is complete!
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button className="btn" onClick={() => setKeepChatting(true)} data-testid="keep-chatting">
                Keep chatting
              </button>
              <Link href="/session/summary" className="btn btn-primary" data-testid="next-step">
                Next: summary <IconArrowRight size={18} />
              </Link>
            </div>
          </div>
        )}
        {showInput && (
          <ChatInput
            value={draft}
            onChange={setDraft}
            onSend={send}
            disabled={busy || conv.pending}
            placeholder={mic.listening ? "Listening… speak German" : "Write in German…"}
            extra={
              <MicButton
                listening={mic.listening}
                availability={mic.availability}
                onStart={() => mic.start()}
                onStop={mic.stop}
                disabled={busy}
              />
            }
            note={
              mic.error ??
              (mic.availability === "insecure" || mic.availability === "unsupported" ? MIC_HELP[mic.availability] : undefined)
            }
          />
        )}
      </section>

      <aside className="card h-fit space-y-3 p-4 lg:sticky lg:top-20">
        <h2 className="font-semibold">Words from chat</h2>
        <WordsFromChat conversation={conv} />
      </aside>
    </div>
  );
}
