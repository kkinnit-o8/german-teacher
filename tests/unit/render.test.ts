import { beforeAll, describe, expect, it } from "vitest";
import { ids, makeWords, run } from "../helpers/german";
import { renderTokens, unlearnedWords, usedWordIds } from "../../src/lib/german/render";
import type { WordLookup } from "../../src/lib/german/types";

const BANK = [
  "der|art",
  "ein|art",
  "ich|pron",
  "du|pron",
  "es|pron",
  "was|pron",
  "haben|verb",
  "essen|verb",
  "gehen|verb",
  "anrufen|verb",
  "kommen|verb",
  "heute|adv",
  "morgen|adv",
  "in|prep",
  "mit|prep",
  "Kind|noun",
  "Zimmer|noun",
  "Haus|noun",
  "klein|adj",
  "sein|verb",
];

let W: WordLookup;
beforeAll(() => {
  W = makeWords(BANK);
});

const marked = (text: string, learned: Set<number>, mode: "unlearned" | "all" | "none" = "unlearned") =>
  renderTokens(run(text, W), learned, mode)
    .filter((t) => t.unlearned)
    .map((t) => t.t);

describe("renderer", () => {
  it("marks only unlearned words (the example from the spec)", () => {
    const learned = ids(W, "ich|pron", "haben|verb", "heute|adv", "was|pron", "du|pron");
    const r = renderTokens(run("Was hast du heute gegessen?", W), learned, "unlearned");
    const unlearned = r.filter((t) => t.unlearned);
    expect(unlearned.map((t) => t.t)).toEqual(["gegessen"]);
    expect(unlearned[0].gloss).toBe("to eat");
    expect(r.filter((t) => t.gloss).length).toBe(1);
  });

  it("with nothing learned, every German word is marked and glossed", () => {
    const r = renderTokens(run("Was hast du heute gegessen?", W), new Set(), "unlearned");
    const words = r.filter((t) => t.word);
    expect(words.every((t) => t.unlearned)).toBe(true);
    expect(words.every((t) => t.gloss)).toBe(true);
  });

  it("with everything learned, nothing is marked", () => {
    const all = new Set(W.all().map((w) => w.id));
    const r = renderTokens(run("Was hast du heute gegessen?", W), all, "unlearned");
    expect(r.some((t) => t.unlearned)).toBe(false);
    expect(r.some((t) => t.gloss)).toBe(false);
  });

  it("gloss modes: all words / none", () => {
    const learned = ids(W, "ich|pron", "haben|verb", "heute|adv", "was|pron", "du|pron");
    const all = renderTokens(run("Was hast du heute gegessen?", W), learned, "all");
    expect(all.filter((t) => t.word).every((t) => t.gloss)).toBe(true);
    const none = renderTokens(run("Was hast du heute gegessen?", W), learned, "none");
    expect(none.some((t) => t.gloss)).toBe(false);
    // challenge mode still marks the unlearned word, just without a gloss
    expect(none.filter((t) => t.unlearned).map((t) => t.t)).toEqual(["gegessen"]);
  });

  it("styles both parts of a separable verb together, gloss on the verb", () => {
    const r = renderTokens(run("Ich rufe dich morgen an.", W), ids(W, "ich|pron", "du|pron", "morgen|adv"), "unlearned");
    const rufe = r.find((t) => t.t === "rufe")!;
    const an = r.find((t) => t.t === "an")!;
    expect(rufe.unlearned).toBe(true);
    expect(an.unlearned).toBe(true);
    expect(rufe.grp).toBe(an.grp);
    expect(rufe.gloss).toBe("to call");
    expect(an.gloss).toBeUndefined();
  });

  it("a separable verb is known once it is learned, even though 'an' alone is not", () => {
    const learned = ids(W, "ich|pron", "du|pron", "morgen|adv", "anrufen|verb");
    expect(marked("Ich rufe dich morgen an.", learned)).toEqual([]);
  });

  it("a compound counts as known only when all parts are learned", () => {
    const text = "Das Kinderzimmer ist klein.";
    const base = ["der|art", "sein|verb", "klein|adj"];
    expect(marked(text, ids(W, ...base, "Kind|noun"))).toEqual(["Kinderzimmer"]);
    expect(marked(text, ids(W, ...base, "Kind|noun", "Zimmer|noun"))).toEqual([]);
  });

  it("a separable verb outside the word bank is known when its parts are", () => {
    expect(marked("Ich komme mit.", ids(W, "ich|pron", "kommen|verb"))).toEqual(["komme", "mit"]);
    expect(marked("Ich komme mit.", ids(W, "ich|pron", "kommen|verb", "mit|prep"))).toEqual([]);
  });

  it("a contraction needs both preposition and article", () => {
    expect(marked("Ich bin im Haus.", ids(W, "ich|pron", "sein|verb", "Haus|noun", "in|prep"))).toEqual(["im"]);
    expect(marked("Ich bin im Haus.", ids(W, "ich|pron", "sein|verb", "Haus|noun", "in|prep", "der|art"))).toEqual(
      [],
    );
  });

  it("never marks punctuation, numbers, names or English", () => {
    const r = renderTokens(run("Anna kommt um 8 Uhr. Okay, thank you!", W), new Set(), "unlearned");
    for (const s of ["Anna", "8", ".", "thank", "you", "!"]) {
      expect(r.find((t) => t.t === s)?.unlearned).toBe(false);
    }
  });

  it("lists unlearned words once per lemma", () => {
    const a = run("Ich gehe, du gehst, wir gehen.", W);
    const list = unlearnedWords(a, ids(W, "ich|pron", "du|pron"));
    expect(list.filter((t) => t.w?.lemma === "gehen").length).toBe(1);
  });

  it("collects the word bank words used in a text", () => {
    const used = usedWordIds(run("Ich rufe dich morgen an.", W));
    expect(used.has(W.byKey("anrufen|verb")!.id)).toBe(true);
    expect(used.has(W.byKey("morgen|adv")!.id)).toBe(true);
  });
});
