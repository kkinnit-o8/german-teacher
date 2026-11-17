"use client";

import type { Analysis } from "@/lib/german/types";

/** Client-side cache + batching for /api/analyze. */
const cache = new Map<string, Promise<Analysis>>();
let pending: { text: string; formal: boolean; resolve: (a: Analysis) => void; reject: (e: unknown) => void }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  timer = null;
  const batch = pending;
  pending = [];
  const groups = new Map<boolean, typeof batch>();
  for (const p of batch) groups.set(p.formal, [...(groups.get(p.formal) ?? []), p]);
  for (const [formal, items] of groups) {
    fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: items.map((i) => i.text), formal }),
    })
      .then((r) => r.json())
      .then((j: { analyses: Analysis[] }) => items.forEach((it, k) => it.resolve(j.analyses[k])))
      .catch((e) => items.forEach((it) => it.reject(e)));
  }
}

export function fetchAnalysis(text: string, formal = false): Promise<Analysis> {
  const key = (formal ? "F:" : "") + text;
  const hit = cache.get(key);
  if (hit) return hit;
  const p = new Promise<Analysis>((resolve, reject) => {
    pending.push({ text, formal, resolve, reject });
    if (!timer) timer = setTimeout(flush, 10);
  });
  p.catch(() => cache.delete(key));
  cache.set(key, p);
  return p;
}

/** Put a server-made analysis into the cache (chat replies come with their analysis). */
export function primeAnalysis(a: Analysis, formal = false) {
  cache.set((formal ? "F:" : "") + a.text, Promise.resolve(a));
}
