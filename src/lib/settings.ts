/** Settings shared by server and client. */

export type GlossMode = "unlearned" | "all" | "none";

export interface Settings {
  newPerDay: number;
  exchangesPerDay: number;
  maxReviews: number;
  model: string;
  glossMode: GlossMode;
  genderColors: boolean;
  autoSpeak: boolean;
  explanationLanguage: string;
}

export const DEFAULT_MODEL = "anthropic/claude-haiku-5.5";

export const MODEL_SUGGESTIONS: { id: string; note: string }[] = [
  { id: "anthropic/claude-haiku-5.5", note: "default: cheap, strong German, structured output" },
  { id: "google/gemini-3.1-flash-lite", note: "cheap and fast, good German" },
  { id: "openai/gpt-5.6-luna", note: "cheap, reliable JSON" },
  { id: "deepseek/deepseek-v4.1-flash", note: "very cheap" },
  { id: "mistralai/mistral-small-2603", note: "cheap, European model" },
  { id: "google/gemini-3.8-flash", note: "stronger, costs more" },
];

export const DEFAULT_SETTINGS: Settings = {
  newPerDay: 10,
  exchangesPerDay: 10,
  maxReviews: 100,
  model: DEFAULT_MODEL,
  glossMode: "unlearned",
  genderColors: true,
  autoSpeak: true,
  explanationLanguage: "English",
};

const clampInt = (v: unknown, min: number, max: number, def: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

/** Validate a partial settings object; unknown keys are dropped, bad values fall back. */
export function sanitizeSettings(input: Partial<Record<keyof Settings, unknown>>, base = DEFAULT_SETTINGS): Settings {
  const s = { ...base };
  if ("newPerDay" in input) s.newPerDay = clampInt(input.newPerDay, 0, 50, base.newPerDay);
  if ("exchangesPerDay" in input) s.exchangesPerDay = clampInt(input.exchangesPerDay, 1, 50, base.exchangesPerDay);
  if ("maxReviews" in input) s.maxReviews = clampInt(input.maxReviews, 10, 1000, base.maxReviews);
  if ("model" in input && typeof input.model === "string" && /^[\w.~:/-]{3,100}$/.test(input.model.trim()))
    s.model = input.model.trim();
  if ("glossMode" in input && ["unlearned", "all", "none"].includes(input.glossMode as string))
    s.glossMode = input.glossMode as GlossMode;
  if ("genderColors" in input) s.genderColors = Boolean(input.genderColors);
  if ("autoSpeak" in input) s.autoSpeak = Boolean(input.autoSpeak);
  if ("explanationLanguage" in input && typeof input.explanationLanguage === "string")
    s.explanationLanguage = input.explanationLanguage.trim().slice(0, 40) || "English";
  return s;
}
