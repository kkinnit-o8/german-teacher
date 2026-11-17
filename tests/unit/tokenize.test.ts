import { describe, expect, it } from "vitest";
import { sentenceStarts, tokenize } from "../../src/lib/german/tokenize";

describe("tokenize", () => {
  it("keeps every character, so the text can be rebuilt", () => {
    const texts = [
      "Was hast du heute gegessen?",
      "„Hallo!“, sagte sie – und ging.",
      "Das kostet 3,50 € (inkl. MwSt.).",
      "Um 20:15 Uhr, am 1.12., kommt der Zug.",
      "Wie geht's dir? Gibt's hier WLAN?",
      "Schreib mir eine E-Mail: anna@example.com 😊",
      "Zeile eins\nZeile zwei",
    ];
    for (const t of texts) expect(tokenize(t).map((x) => x.t).join("")).toBe(t);
  });

  it("splits words, punctuation, spaces and numbers", () => {
    const toks = tokenize("Ich habe 2 Äpfel.");
    expect(toks.map((t) => `${t.k}:${t.t}`)).toEqual(["w:Ich", "s: ", "w:habe", "s: ", "n:2", "s: ", "w:Äpfel", "p:."]);
  });

  it("keeps clitic 's, inner hyphens and umlauts inside one word", () => {
    expect(tokenize("geht's").map((t) => t.t)).toEqual(["geht's"]);
    expect(tokenize("E-Mail-Adresse").map((t) => t.t)).toEqual(["E-Mail-Adresse"]);
    expect(tokenize("Straße größer Füße").filter((t) => t.k === "w").map((t) => t.t)).toEqual([
      "Straße",
      "größer",
      "Füße",
    ]);
  });

  it("reads decimal numbers and times as one number", () => {
    expect(tokenize("3,50").map((t) => t.k)).toEqual(["n"]);
    expect(tokenize("20:15").map((t) => t.k)).toEqual(["n"]);
  });

  it("marks sentence starts", () => {
    const toks = tokenize("Heute regnet es. Morgen nicht! Und dann?");
    const starts = sentenceStarts(toks);
    const startWords = toks.filter((t, i) => starts[i]).map((t) => t.t);
    expect(startWords).toEqual(["Heute", "Morgen", "Und"]);
  });
});
