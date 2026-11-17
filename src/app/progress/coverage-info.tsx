"use client";

import { useState } from "react";

/** The tooltip that explains the coverage estimate. */
export function CoverageInfo() {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative">
      <button
        className="grid h-6 w-6 place-items-center rounded-full border border-border text-sm font-bold text-muted hover:text-text"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        aria-expanded={open}
        aria-label="How is this estimated?"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="card absolute top-8 left-1/2 z-20 block w-80 -translate-x-1/2 p-4 text-sm font-normal shadow-xl"
        >
          A few words make up most of any text: <em>der/die/das</em> alone are about one word in eight. The estimate uses
          word frequencies from the wordfreq project (books, subtitles, news, Wikipedia and the web). Each word in the word
          bank has a share of everyday text (all its forms together), and the estimate adds up the shares of the words you
          have learned. Names, numbers and rare words aren’t counted, and knowing 90% of the words doesn’t mean
          understanding 90% of a text, so treat it as a rough guide.
        </span>
      )}
    </span>
  );
}
