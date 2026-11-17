"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppState } from "./app-state";
import { renderTokens } from "@/lib/german/render";
import type { AToken, Analysis } from "@/lib/german/types";
import { fetchAnalysis } from "@/lib/client/analysis";
import { WordPopup } from "./word-popup";

interface Props {
  analysis: Analysis;
  className?: string;
  /** override the gloss mode (e.g. Learn cards) */
  glossMode?: "unlearned" | "all" | "none";
  /** text of the whole sentence, for the popup's context */
  as?: "span" | "p" | "div";
}

/**
 * Renders German with the core rule: learned words plain, unlearned words
 * marked with a small English gloss above them. Every word can be tapped.
 */
export function GermanText({ analysis, className = "", glossMode, as = "span" }: Props) {
  const { learned, settings } = useAppState();
  const mode = glossMode ?? settings.glossMode;
  const tokens = useMemo(() => renderTokens(analysis, learned, mode), [analysis, learned, mode]);
  const [hoverGrp, setHoverGrp] = useState<number | null>(null);
  const [open, setOpen] = useState<AToken | null>(null);
  const hasGloss = tokens.some((t) => t.gloss);
  const Tag = as;

  return (
    <>
      <Tag className={`de-text ${hasGloss ? "" : "no-gloss"} ${className}`} lang="de">
        {tokens.map((t) => {
          if (!t.word) return <span key={t.i}>{t.t}</span>;
          const src = analysis.tokens[t.i];
          if (src.name || src.foreign || src.unknown) {
            return (
              <span key={t.i} lang={src.foreign ? "en" : undefined}>
                {t.t}
              </span>
            );
          }
          const cls = [
            "de-word",
            t.unlearned ? "de-unlearned" : "",
            t.gc ? `g-${t.gc}` : "",
            t.grp && t.grp === hoverGrp ? "group-hover" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const inner = t.gloss ? (
            <ruby className="de-ruby">
              {t.t}
              <rt>{t.gloss}</rt>
            </ruby>
          ) : (
            t.t
          );
          return (
            <span
              key={t.i}
              className={cls}
              role="button"
              tabIndex={0}
              data-unlearned={t.unlearned ? "true" : undefined}
              aria-label={t.gloss ? `${t.t} (${t.gloss})` : t.t}
              onMouseEnter={() => t.grp && setHoverGrp(t.grp)}
              onMouseLeave={() => t.grp && setHoverGrp(null)}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(src);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpen(src);
                }
              }}
            >
              {inner}
            </span>
          );
        })}
      </Tag>
      {open && <WordPopup token={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/** Analyses the text through the API, then renders it. Shows plain text meanwhile. */
export function GermanTextAuto({
  text,
  formal,
  className,
  glossMode,
  as,
}: {
  text: string;
  formal?: boolean;
  className?: string;
  glossMode?: Props["glossMode"];
  as?: Props["as"];
}) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  useEffect(() => {
    let alive = true;
    fetchAnalysis(text, formal)
      .then((a) => alive && setAnalysis(a))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [text, formal]);
  if (!analysis || analysis.text !== text) {
    const Tag = as ?? "span";
    return (
      <Tag className={`de-text no-gloss ${className ?? ""}`} lang="de">
        {text}
      </Tag>
    );
  }
  return <GermanText analysis={analysis} className={className} glossMode={glossMode} as={as} />;
}
