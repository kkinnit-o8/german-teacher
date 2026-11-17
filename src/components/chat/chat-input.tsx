"use client";

import { useRef } from "react";
import { IconArrowRight } from "../icons";

/** Message box: Enter sends, Shift+Enter adds a line. Controlled by the parent (speech input writes into it). */
export function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  placeholder = "Write in German…",
  extra,
  note,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: (text: string) => Promise<boolean> | void;
  disabled?: boolean;
  placeholder?: string;
  /** extra controls (the mic button) */
  extra?: React.ReactNode;
  /** small text under the box (e.g. why the mic is unavailable) */
  note?: React.ReactNode;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const submit = async () => {
    const t = value.trim();
    if (!t || disabled) return;
    onChange("");
    const ok = await onSend(t);
    if (ok === false) onChange(t);
    ref.current?.focus();
  };
  const insert = (ch: string) => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + ch + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + 1, start + 1);
    });
  };
  return (
    <div className="card sticky bottom-20 space-y-2 p-3 md:bottom-4">
      <div className="flex items-end gap-2">
        <textarea
          ref={ref}
          className="input min-h-12 flex-1 resize-none text-lg"
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          lang="de"
          aria-label="Your message"
          data-testid="chat-input"
          autoComplete="off"
        />
        {extra}
        <button
          className="btn btn-primary h-12"
          onClick={submit}
          disabled={disabled || !value.trim()}
          aria-label="Send"
          data-testid="chat-send"
        >
          <IconArrowRight />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {["ä", "ö", "ü", "ß"].map((ch) => (
          <button
            key={ch}
            type="button"
            className="btn btn-sm min-w-9"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insert(ch)}
            aria-label={`insert ${ch}`}
          >
            {ch}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted">Enter to send · umlauts optional</span>
      </div>
      {note && <div className="text-xs text-muted">{note}</div>}
    </div>
  );
}
