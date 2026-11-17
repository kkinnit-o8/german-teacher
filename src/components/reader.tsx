"use client";

import { useState } from "react";
import { GermanTextAuto } from "./german-text";

const SAMPLE = "Was hast du heute gegessen? Ich rufe dich morgen an, weil ich im Kinderzimmer aufräumen muss.";

/** Paste any German text and read it with the gloss rule. */
export function Reader() {
  const [text, setText] = useState(SAMPLE);
  const [shown, setShown] = useState(SAMPLE);
  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-lg font-semibold">Reader</h2>
      <p className="text-sm text-muted">
        Paste any German text. Words you have learned show as plain German; the others get their meaning above them.
        Tap a word for details.
      </p>
      <textarea
        className="input min-h-24"
        value={text}
        onChange={(e) => setText(e.target.value)}
        lang="de"
        aria-label="German text to read"
      />
      <button className="btn btn-primary" onClick={() => setShown(text)}>
        Read
      </button>
      {shown.trim() && (
        <div className="rounded-xl bg-surface-2 p-4 text-xl" data-testid="reader-output">
          <GermanTextAuto text={shown} as="p" />
        </div>
      )}
    </section>
  );
}
