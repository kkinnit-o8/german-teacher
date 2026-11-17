import type { Word } from "../words/types";
import { compoundFormsOf } from "./compounds";
import type { WordLookup, WordRef } from "./types";

export function wordToRef(w: Word): WordRef {
  const ref: WordRef = {
    id: w.id,
    key: w.key,
    lemma: w.lemma,
    pos: w.pos,
    gloss: w.meanings[0] ?? "",
    rank: w.rank,
  };
  if (w.noun?.gender) ref.gender = w.noun.gender;
  if (w.forms) ref.forms = w.forms;
  if (w.dictIds) ref.dictIds = w.dictIds;
  ref.compoundForms = compoundFormsOf({ lemma: w.lemma, pos: w.pos, plural: w.noun?.plural });
  return ref;
}

export function makeWordLookup(refs: WordRef[]): WordLookup {
  const byId = new Map<number, WordRef>();
  const byKey = new Map<string, WordRef>();
  const byLemma = new Map<string, WordRef[]>();
  const byDict = new Map<number, WordRef>();
  for (const r of refs) {
    byId.set(r.id, r);
    byKey.set(r.key, r);
    const l = byLemma.get(r.lemma) ?? [];
    l.push(r);
    byLemma.set(r.lemma, l);
  }
  // dictionary ids: content words first, so a family never shadows a content word
  for (const r of refs) if (!r.forms) for (const d of r.dictIds ?? []) if (!byDict.has(d)) byDict.set(d, r);
  return {
    byId: (id) => byId.get(id),
    byKey: (k) => byKey.get(k),
    byLemma: (l) => byLemma.get(l) ?? [],
    byDictId: (d) => byDict.get(d),
    all: () => refs,
  };
}
