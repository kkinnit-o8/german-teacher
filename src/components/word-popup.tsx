"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { AToken, WordInfo } from "@/lib/german/types";
import type { DictEntry } from "@/lib/dict/types";
import type { Word } from "@/lib/words/types";
import { POS_LABEL, genderClass, pluralLabel, verbFormsLabel } from "@/lib/words/format";
import { useAppState } from "./app-state";
import { useSpeech } from "./use-speech";
import { IconCheck, IconPlus, IconSpeaker, IconX } from "./icons";

interface Details {
  word: Word | null;
  entry: DictEntry | null;
  learned: boolean;
  queued: boolean;
}

async function loadDetails(info: WordInfo): Promise<Details> {
  const q = info.wid ? `wid=${info.wid}` : info.dict ? `dict=${info.dict}` : "";
  if (!q) return { word: null, entry: null, learned: false, queued: false };
  const r = await fetch(`/api/lookup?${q}`);
  return r.json();
}

export function displayOf(word: Word | null, entry: DictEntry | null, info: WordInfo): string {
  if (word) return word.display;
  if (entry?.p === "noun" && entry.g?.[0]) {
    const g = entry.g[0];
    return `${g === "m" ? "der" : g === "n" ? "das" : "die"} ${entry.w}`;
  }
  return entry?.w ?? info.lemma;
}

function WordBlock({ info, onQueued }: { info: WordInfo; onQueued?: () => void }) {
  const [d, setD] = useState<Details | null>(null);
  const [busy, setBusy] = useState(false);
  const { speak, silent } = useSpeech();
  const { learned } = useAppState();
  useEffect(() => {
    let alive = true;
    loadDetails(info).then((x) => alive && setD(x));
    return () => {
      alive = false;
    };
  }, [info]);

  const word = d?.word ?? null;
  const entry = d?.entry ?? null;
  const display = displayOf(word, entry, info);
  const gender = word?.noun?.gender ?? (entry?.p === "noun" ? entry.g?.[0] : undefined);
  const meanings = word?.meanings ?? entry?.m?.slice(0, 3) ?? (info.gloss ? [info.gloss] : []);
  const isLearned = word ? learned.has(word.id) : false;
  const forms = word
    ? word.noun
      ? [pluralLabel(word), word.noun.genitive ? `des ${word.noun.genitive}` : ""].filter(Boolean).join(" · ")
      : word.verb
        ? verbFormsLabel(word)
        : word.adj
          ? [word.lemma, word.adj.comparative, word.adj.superlative].filter(Boolean).join(" · ")
          : ""
    : entry?.noun
      ? [entry.noun.pl?.[0] ? `die ${entry.noun.pl[0]}` : "", entry.noun.gs?.[0] ? `des ${entry.noun.gs[0]}` : ""]
          .filter(Boolean)
          .join(" · ")
      : entry?.verb
        ? [entry.verb.p3 && `er ${entry.verb.p3}`, entry.verb.pt && `er ${entry.verb.pt}`, entry.verb.pp]
            .filter(Boolean)
            .join(" · ")
        : "";

  async function queue() {
    setBusy(true);
    const body = word ? { wid: word.id, source: "popup" } : { dict: info.dict, source: "popup" };
    const r = await fetch("/api/queue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (r.ok) {
      setD((x) => (x ? { ...x, queued: true } : x));
      onQueued?.();
    }
  }

  const canQueue = (word || info.dict) && !isLearned;
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className={`text-2xl font-bold ${genderClass(gender)}`} lang="de">
            {display}
          </div>
          <div className="text-sm text-muted">
            {(word?.pos ?? entry?.p) && POS_LABEL[(word?.pos ?? entry?.p)!]}
            {(word?.ipa ?? entry?.ipa) && <span className="ml-2 font-mono">/{word?.ipa ?? entry?.ipa}/</span>}
            {word && <span className="ml-2 chip">{word.cefr}</span>}
          </div>
        </div>
        {!silent && (
          <button
            className="btn btn-sm"
            onClick={() => speak(word?.lemma ?? entry?.w ?? info.lemma)}
            aria-label={`Play ${display}`}
          >
            <IconSpeaker size={18} />
          </button>
        )}
      </div>
      {meanings.length > 0 && <p className="text-lg">{meanings.join("; ")}</p>}
      {forms && (
        <p className="text-sm text-muted" lang="de">
          {forms}
        </p>
      )}
      {!d && <p className="text-sm text-muted">Loading…</p>}
      {d && !word && !entry && <p className="text-sm text-muted">This word is not in the dictionary.</p>}
      <div className="flex flex-wrap gap-2 pt-1">
        {isLearned ? (
          <span className="chip !text-good">
            <IconCheck size={14} /> learned
          </span>
        ) : d?.queued ? (
          <span className="chip !text-accent">
            <IconCheck size={14} /> in your learning queue
          </span>
        ) : canQueue ? (
          <button className="btn btn-sm btn-primary" onClick={queue} disabled={busy} data-testid="queue-word">
            <IconPlus size={16} /> Add to my learning queue
          </button>
        ) : null}
        {word && (
          <Link className="btn btn-sm" href={`/words/${word.id}`}>
            Word page
          </Link>
        )}
      </div>
    </div>
  );
}

/** Popup for a tapped word: lemma, forms, IPA, meaning, audio and "add to my learning queue". */
export function WordPopup({ token, onClose }: { token: AToken; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const parts = token.pt === "contraction" || token.pt === "clitic" || token.pt === "compound" ? token.parts : undefined;
  const main = token.pt === "contraction" ? undefined : token.w;
  const formNote =
    main && token.t.toLowerCase() !== main.lemma.toLowerCase()
      ? `“${token.t}” is a form of ${main.lemma}${token.note ? ` (${token.note})` : ""}`
      : token.pt === "separable"
        ? `separable verb: the parts are written apart`
        : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="card max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-b-none p-5 shadow-xl sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={`Word: ${token.t}`}
        onClick={(e) => e.stopPropagation()}
        data-testid="word-popup"
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-muted" lang="de">
            {token.t}
          </span>
          <button ref={closeRef} className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Close">
            <IconX size={18} />
          </button>
        </div>
        {formNote && <p className="mb-3 text-sm text-muted">{formNote}</p>}
        {main && <WordBlock info={main} />}
        {parts && (
          <div className="mt-4 space-y-4 border-t border-border pt-4">
            <p className="text-sm font-semibold text-muted">
              {token.pt === "compound" ? "Made of" : token.pt === "contraction" ? `${token.t} =` : "Parts"}
            </p>
            {parts.map((p, i) => (
              <WordBlock key={i} info={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
