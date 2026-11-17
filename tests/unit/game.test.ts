import { describe, expect, it } from "vitest";
import { applyTurn, computeStars, isEnglish, isFormalitySlip, isRude, newGame, usesDu } from "../../src/lib/game/rules";
import { parseGameReply } from "../../src/lib/game/response";
import { gameSystemPrompt } from "../../src/lib/game/prompt";
import { MISSIONS, MISSION_BY_ID } from "../../src/lib/game/missions";
import { CHARACTER_BY_ID } from "../../src/lib/game/characters";

// a tiny stand-in for the dictionary lookup
const GERMAN = new Set(
  "ich möchte einen kaffee bitte was kostet das die ein eine und der hallo danke so also will was hat an in man kann ist es gut".split(" "),
);
const isGerman = (w: string) => GERMAN.has(w);

describe("English detection (decided by code, benefit of the doubt)", () => {
  it("flags clear English", () => {
    expect(isEnglish("I want a coffee please", isGerman)).toBe(true);
    expect(isEnglish("How much is it?", isGerman)).toBe(true);
    expect(isEnglish("thank you very much", isGerman)).toBe(true);
    // "a" and "ticket" are German forms too, but the rest is clearly English
    expect(isEnglish("I want a ticket to Hamburg please", (w) => ["a", "ticket"].includes(w))).toBe(true);
  });

  it("does not flag German, even without umlauts or with typos", () => {
    expect(isEnglish("Ich möchte einen Kaffee, bitte", isGerman)).toBe(false);
    expect(isEnglish("ich mochte einen kafee bitte", isGerman)).toBe(false);
    expect(isEnglish("Was kostet das?", isGerman)).toBe(false);
  });

  it("gives the benefit of the doubt", () => {
    expect(isEnglish("okay", isGerman)).toBe(false); // one word
    expect(isEnglish("sorry", isGerman)).toBe(false);
    expect(isEnglish("Hallo, ich möchte a coffee", isGerman)).toBe(false); // mostly German
    expect(isEnglish("so was", isGerman)).toBe(false); // words that are German too
    expect(isEnglish("", isGerman)).toBe(false);
  });
});

describe("du and Sie", () => {
  it("detects du-forms", () => {
    expect(usesDu("Kannst du mir helfen?")).toBe(true);
    expect(usesDu("Gib mir bitte das Ticket")).toBe(true);
    expect(usesDu("Können Sie mir helfen?")).toBe(false);
  });

  it("is a slip only towards someone who expects Sie", () => {
    expect(isFormalitySlip("Hast du ein Ticket?", true)).toBe(true);
    expect(isFormalitySlip("Hast du ein Ticket?", false)).toBe(false);
    expect(isFormalitySlip("Haben Sie ein Ticket für dich?", true)).toBe(false); // Sie used
    expect(isFormalitySlip("Ein Ticket, bitte.", true, true)).toBe(false); // AI flag alone isn't enough
  });

  it("rudeness: AI flag or obvious insults", () => {
    expect(isRude("Du Idiot!", false)).toBe(true);
    expect(isRude("Einen Kaffee, bitte.", false)).toBe(false);
    expect(isRude("Gib mir Kaffee, sofort!", true)).toBe(true);
  });
});

describe("hearts and stars", () => {
  const goals = ["a", "b", "c"];
  const turn = (over: Partial<Parameters<typeof applyTurn>[1]> = {}) => ({
    text: "x",
    english: false,
    rude: false,
    formalitySlip: false,
    goalsCompleted: [],
    allGoals: goals,
    ...over,
  });

  it("English and rudeness cost a heart each", () => {
    let s = newGame("m");
    s = applyTurn(s, turn({ english: true })).state;
    expect(s.hearts).toBe(2);
    s = applyTurn(s, turn({ rude: true })).state;
    expect(s.hearts).toBe(1);
    expect(s.heartsLost).toBe(2);
  });

  it("the first du to a Sie person is a warning, then it costs a heart", () => {
    let s = newGame("m");
    const r1 = applyTurn(s, turn({ formalitySlip: true }));
    s = r1.state;
    expect(s.hearts).toBe(3);
    expect(r1.events[0].kind).toBe("formality-warning");
    const r2 = applyTurn(s, turn({ formalitySlip: true }));
    expect(r2.state.hearts).toBe(2);
    expect(r2.events[0].kind).toBe("formality");
  });

  it("with no hearts left the character gives up", () => {
    let s = newGame("m");
    for (let i = 0; i < 3; i++) s = applyTurn(s, turn({ english: true })).state;
    expect(s.hearts).toBe(0);
    expect(s.status).toBe("lost");
    expect(computeStars(s).stars).toBe(0);
  });

  it("completes when all goals are done and counts stars", () => {
    let s = newGame("m");
    s = applyTurn(s, turn({ goalsCompleted: ["a", "b"] })).state;
    expect(s.status).toBe("playing");
    s = applyTurn(s, turn({ goalsCompleted: ["c", "unknown"] })).state;
    expect(s.status).toBe("won");
    expect(s.goalsDone).toEqual(["a", "b", "c"]);
    expect(computeStars(s).stars).toBe(3);
    expect(computeStars({ ...s, heartsLost: 2 }).stars).toBe(2);
    expect(computeStars({ ...s, heartsLost: 2, hintsUsed: 2 }).stars).toBe(1);
    expect(computeStars({ ...s, hintsUsed: 1, heartsLost: 1 }).stars).toBe(3);
  });
});

describe("game master output", () => {
  const cast = ["lena", "jonas"];
  it("parses a well-formed reply", () => {
    const r = parseGameReply(
      JSON.stringify({
        lines: [{ speaker: "lena", de: "Hallo! Was darf es sein?", en: "Hi! What can I get you?", expression: "happy" }],
        goals_completed: ["greet"],
        correction: null,
        hint: "Einen Kaffee, bitte.",
        rude: false,
        formality_slip: false,
        mission_complete: false,
      }),
      cast,
    );
    expect(r.ok && r.value.lines[0].speaker).toBe("lena");
    expect(r.ok && r.value.goalsCompleted).toEqual(["greet"]);
  });

  it("repairs unknown speakers and expressions, tolerates missing fields", () => {
    const r = parseGameReply('{"lines":[{"speaker":"barista","de":"Hallo!","expression":"ecstatic"}]}', cast);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.lines[0].speaker).toBe("lena");
      expect(r.value.lines[0].expression).toBe("neutral");
      expect(r.value.goalsCompleted).toEqual([]);
      expect(r.value.rude).toBe(false);
    }
  });

  it("rejects replies without lines", () => {
    expect(parseGameReply('{"lines":[]}', cast).ok).toBe(false);
    expect(parseGameReply("Hallo!", cast).ok).toBe(false);
  });
});

describe("missions", () => {
  it("are complete and consistent", () => {
    expect(MISSIONS.length).toBe(10);
    for (const m of MISSIONS) {
      expect(m.goals.length).toBeGreaterThanOrEqual(3);
      expect(m.goals.length).toBeLessThanOrEqual(5);
      for (const c of m.cast) expect(CHARACTER_BY_ID.has(c)).toBe(true);
      expect(m.facts.length).toBeGreaterThan(0);
      expect(m.keyWords.length).toBeGreaterThan(0);
    }
  });

  it("the prompt lists goals, speakers and facts", () => {
    const m = MISSION_BY_ID.get("cafe-coffee")!;
    const p = gameSystemPrompt({ mission: m, learnedLemmas: ["ich"], keyKnown: ["bitte"], keyNew: ["Kaffee"], goalsDone: ["greet"], explanationLanguage: "English" });
    expect(p).toContain("game master");
    expect(p).toContain("- [coffee] Order a coffee");
    expect(p).toContain("(already done)");
    expect(p).toContain("SPEAKERS: lena, jonas");
    expect(p).toContain("3,20 €");
  });
});
