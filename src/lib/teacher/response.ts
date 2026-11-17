/**
 * The teacher's structured reply: schema for OpenRouter's structured outputs,
 * and a tolerant parser (models sometimes wrap JSON in prose or use other shapes).
 */
import { z } from "zod";
import { extractJson } from "../openrouter";

export interface Correction {
  explanation: string;
  corrected: string;
}

export interface TeacherReply {
  reply: string;
  translation: string;
  correction: Correction | null;
  hint: string;
}

export const TEACHER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "translation", "correction", "hint"],
  properties: {
    reply: { type: "string", description: "German message, 1-2 short sentences" },
    translation: { type: "string" },
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
  },
} as const;

const CorrectionZ = z
  .union([
    z.null(),
    z.object({ explanation: z.string(), corrected: z.string().optional().default("") }),
    z.string(),
  ])
  .optional()
  .transform((c): Correction | null => {
    if (c == null) return null;
    if (typeof c === "string") {
      const t = c.trim();
      if (!t || /^(none|null|no correction|n\/a|-)$/i.test(t)) return null;
      return { explanation: t, corrected: "" };
    }
    if (!c.explanation.trim() && !c.corrected.trim()) return null;
    return { explanation: c.explanation.trim(), corrected: c.corrected.trim() };
  });

const ReplyZ = z.object({
  reply: z.string().min(1),
  translation: z.string().optional().default(""),
  correction: CorrectionZ,
  hint: z.string().optional().default(""),
});

export type ParseResult = { ok: true; value: TeacherReply } | { ok: false; error: string };

/** Parse the model's text into a TeacherReply. */
export function parseTeacherReply(text: string): ParseResult {
  const json = extractJson(text);
  if (json === undefined) return { ok: false, error: "not JSON" };
  const r = ReplyZ.safeParse(json);
  if (!r.success) return { ok: false, error: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const v = r.data;
  return {
    ok: true,
    value: {
      reply: v.reply.trim(),
      translation: v.translation.trim(),
      correction: v.correction ?? null,
      hint: v.hint.trim(),
    },
  };
}
