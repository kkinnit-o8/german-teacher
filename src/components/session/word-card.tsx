"use client";

import type { Word } from "@/lib/words/types";
import { POS_LABEL, genderClass, pluralLabel, verbFormsLabel } from "@/lib/words/format";
import { GermanTextAuto } from "../german-text";
import { SpeakButton } from "../speak-button";

export function spokenForm(w: Word): string {
  return w.noun && !w.noun.pluralOnly ? `${w.noun.article} ${w.lemma}` : w.verb?.reflexive ? `sich ${w.lemma}` : w.lemma;
}

/** The word in large text coloured by gender, with audio. */
export function WordHeadline({ word, size = "text-5xl" }: { word: Word; size?: string }) {
  return (
    <div className="flex items-center justify-center gap-3">
      <h2 className={`${size} text-center font-bold tracking-tight ${genderClass(word.noun?.gender)}`} lang="de">
        {word.display}
      </h2>
      <SpeakButton text={spokenForm(word)} />
    </div>
  );
}

/** Meaning, forms, IPA and example sentence. */
export function WordDetails({ word, showExample = true }: { word: Word; showExample?: boolean }) {
  const forms = word.noun
    ? `Plural: ${pluralLabel(word)}`
    : word.verb
      ? verbFormsLabel(word)
      : word.adj && (word.adj.comparative || word.adj.superlative)
        ? [word.lemma, word.adj.comparative, word.adj.superlative].filter(Boolean).join(" · ")
        : "";
  return (
    <div className="space-y-3 text-center">
      <p className="text-2xl">{word.meanings.join("; ")}</p>
      <p className="text-sm text-muted">
        {POS_LABEL[word.pos]}
        {word.ipa && <span className="ml-2 font-mono">/{word.ipa}/</span>}
        <span className="ml-2 chip">{word.cefr}</span>
      </p>
      {forms && (
        <p className="text-lg" lang="de">
          {forms}
          {word.verb?.aux && (
            <span className="ml-2 chip">with {word.verb.aux === "haben/sein" ? "haben or sein" : word.verb.aux}</span>
          )}
          {word.verb?.separable && <span className="ml-2 chip">separable</span>}
        </p>
      )}
      {word.forms && (
        <p className="text-muted" lang="de">
          {Object.entries(word.forms)
            .map(([f, g]) => `${f} = ${g}`)
            .join(" · ")}
        </p>
      )}
      {showExample && word.example && (
        <div className="mx-auto max-w-xl rounded-xl bg-surface-2 p-4 text-left">
          <div className="flex items-start gap-2 text-xl">
            <GermanTextAuto text={word.example.de} as="p" className="flex-1" />
            <SpeakButton text={word.example.de} />
          </div>
          <p className="mt-1 text-muted">{word.example.en}</p>
        </div>
      )}
    </div>
  );
}
