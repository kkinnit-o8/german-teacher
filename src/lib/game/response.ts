import { z } from "zod";
import { extractJson } from "../openrouter";
import type { Correction } from "../teacher/response";
import { EXPRESSIONS } from "./characters";
import type { NpcLine } from "./rules";

export interface GameReply {
  lines: NpcLine[];
  goalsCompleted: string[];
  correction: Correction | null;
  hint: string;
  rude: boolean;
  formalitySlip: boolean;
  missionComplete: boolean;
}

export const GAME_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["lines", "goals_completed", "correction", "hint", "rude", "formality_slip", "mission_complete"],
  properties: {
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["speaker", "de", "en", "expression"],
        properties: {
          speaker: { type: "string" },
          de: { type: "string" },
          en: { type: "string" },
          expression: { type: "string", enum: [...EXPRESSIONS] },
        },
      },
    },
    goals_completed: { type: "array", items: { type: "string" } },
    correction: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["explanation", "corrected"],
          properties: { explanation: { type: "string" }, corrected: { type: "string" } },
        },
      ],
    },
    hint: { type: "string" },
    rude: { type: "boolean" },
    formality_slip: { type: "boolean" },
    mission_complete: { type: "boolean" },
  },
} as const;

const LineZ = z.object({
  speaker: z.string(),
  de: z.string().min(1),
  en: z.string().optional().default(""),
  expression: z.string().optional().default("neutral"),
});

const ReplyZ = z.object({
  lines: z.array(LineZ).min(1),
  goals_completed: z.array(z.string()).optional().default([]),
  correction: z
    .union([z.null(), z.object({ explanation: z.string(), corrected: z.string().optional().default("") }), z.string()])
    .optional(),
  hint: z.string().optional().default(""),
  rude: z.boolean().optional().default(false),
  formality_slip: z.boolean().optional().default(false),
  mission_complete: z.boolean().optional().default(false),
});

/** Parse the game master's JSON; unknown speakers fall back to the first cast member, unknown expressions to neutral. */
export function parseGameReply(text: string, cast: string[]): { ok: true; value: GameReply } | { ok: false; error: string } {
  const json = extractJson(text);
  if (json === undefined) return { ok: false, error: "not JSON" };
  const r = ReplyZ.safeParse(json);
  if (!r.success) return { ok: false, error: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const v = r.data;
  let correction: Correction | null = null;
  if (typeof v.correction === "string") correction = v.correction.trim() ? { explanation: v.correction.trim(), corrected: "" } : null;
  else if (v.correction) correction = { explanation: v.correction.explanation, corrected: v.correction.corrected };
  return {
    ok: true,
    value: {
      lines: v.lines.slice(0, 3).map((l) => ({
        speaker: cast.includes(l.speaker) ? l.speaker : cast[0],
        de: l.de.trim(),
        en: l.en.trim(),
        expression: (EXPRESSIONS as readonly string[]).includes(l.expression) ? l.expression : "neutral",
      })),
      goalsCompleted: v.goals_completed,
      correction,
      hint: v.hint.trim(),
      rude: v.rude,
      formalitySlip: v.formality_slip,
      missionComplete: v.mission_complete,
    },
  };
}
