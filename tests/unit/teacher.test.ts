import { describe, expect, it } from "vitest";
import { parseTeacherReply } from "../../src/lib/teacher/response";
import { grammarLevel, systemPrompt, TOPICS } from "../../src/lib/teacher/prompt";
import { lowestEffort } from "../../src/lib/openrouter";

describe("parsing the teacher's reply", () => {
  it("reads a well-formed reply", () => {
    const r = parseTeacherReply(
      JSON.stringify({ reply: "Hallo! Wie geht es dir?", translation: "Hello! How are you?", correction: null, hint: "Mir geht es gut." }),
    );
    expect(r).toEqual({
      ok: true,
      value: { reply: "Hallo! Wie geht es dir?", translation: "Hello! How are you?", correction: null, hint: "Mir geht es gut." },
    });
  });

  it("reads a correction object", () => {
    const r = parseTeacherReply(
      JSON.stringify({
        reply: "Super!",
        translation: "Great!",
        correction: { explanation: "Tisch is masculine: der Tisch.", corrected: "Der Tisch ist groß." },
        hint: "",
      }),
    );
    expect(r.ok && r.value.correction).toEqual({ explanation: "Tisch is masculine: der Tisch.", corrected: "Der Tisch ist groß." });
  });

  it("accepts JSON wrapped in a code fence or prose", () => {
    const text = 'Here you go:\n```json\n{"reply":"Gut!","translation":"Good!","correction":null,"hint":"Ja."}\n```';
    expect(parseTeacherReply(text).ok).toBe(true);
  });

  it("tolerates missing optional fields and a string correction", () => {
    const r = parseTeacherReply('{"reply":"Gut!","correction":"Use der, not die."}');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.translation).toBe("");
      expect(r.value.hint).toBe("");
      expect(r.value.correction).toEqual({ explanation: "Use der, not die.", corrected: "" });
    }
    const none = parseTeacherReply('{"reply":"Gut!","correction":"none","translation":"Good","hint":"x"}');
    expect(none.ok && none.value.correction).toBe(null);
  });

  it("rejects text without a reply", () => {
    expect(parseTeacherReply("Sorry, I cannot help.").ok).toBe(false);
    expect(parseTeacherReply('{"translation":"x"}').ok).toBe(false);
    expect(parseTeacherReply('{"reply":""}').ok).toBe(false);
  });
});

describe("teacher prompt", () => {
  it("grows the grammar with the vocabulary", () => {
    expect(grammarLevel(0).level).toBe(1);
    expect(grammarLevel(149).level).toBe(1);
    expect(grammarLevel(150).level).toBe(2);
    expect(grammarLevel(400).level).toBe(3);
    expect(grammarLevel(800).level).toBe(4);
    expect(grammarLevel(2000).level).toBe(5);
  });

  it("contains the word list, today's words, the topic and the wrap-up instruction", () => {
    const p = systemPrompt({
      learnedLemmas: ["ich", "du", "essen"],
      todayWords: ["der Tisch", "essen"],
      todayUnused: ["der Tisch"],
      topic: TOPICS[0],
      exchangesLeft: 1,
      isLast: true,
      extended: false,
      explanationLanguage: "English",
    });
    expect(p).toContain("ich, du, essen");
    expect(p).toContain("still unused: der Tisch");
    expect(p).toContain("Food and drink");
    expect(p).toContain("LAST message");
    expect(p).toContain("du");
    expect(p).toContain('"correction"');
  });
});

describe("reasoning effort", () => {
  it("uses the lowest effort the model accepts", () => {
    expect(lowestEffort(null)).toBe(null);
    expect(lowestEffort({ id: "x", supported_parameters: ["temperature"] })).toBe(null);
    expect(
      lowestEffort({ id: "x", supported_parameters: ["reasoning"], reasoning: { supported_efforts: ["high", "low", "none"] } }),
    ).toBe("none");
    expect(
      lowestEffort({
        id: "x",
        supported_parameters: ["reasoning"],
        reasoning: { mandatory: true, supported_efforts: ["high", "low", "minimal", "none"] },
      }),
    ).toBe("minimal");
    expect(lowestEffort({ id: "x", supported_parameters: ["reasoning"] })).toBe("minimal");
  });
});
