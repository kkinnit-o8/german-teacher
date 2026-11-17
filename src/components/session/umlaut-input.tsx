"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  label: string;
  testId?: string;
}

/** A text input with ä ö ü ß buttons that insert at the cursor. */
export const UmlautInput = forwardRef<HTMLInputElement, Props>(function UmlautInput(
  { value, onChange, onEnter, placeholder, disabled, autoFocus, label, testId },
  ref,
) {
  const inner = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inner.current!);
  const insert = (ch: string) => {
    const el = inner.current;
    if (!el) return onChange(value + ch);
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + ch + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + 1, start + 1);
    });
  };
  return (
    <div className="space-y-2">
      <input
        ref={inner}
        className="input text-xl"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter?.();
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        lang="de"
        aria-label={label}
        data-testid={testId}
      />
      <div className="flex gap-2">
        {["ä", "ö", "ü", "ß"].map((ch) => (
          <button
            key={ch}
            type="button"
            className="btn btn-sm min-w-11 text-lg"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insert(ch)}
            disabled={disabled}
            aria-label={`insert ${ch}`}
          >
            {ch}
          </button>
        ))}
      </div>
    </div>
  );
});
