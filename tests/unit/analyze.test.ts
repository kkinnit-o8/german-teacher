import { beforeAll, describe, expect, it } from "vitest";
import { ids, makeWords, run, tok, wordsOf } from "../helpers/german";
import type { WordLookup } from "../../src/lib/german/types";

const BANK = [
  "der|art",
  "ein|art",
  "kein|det",
  "mein|det",
  "dein|det",
  "sein|det",
  "ihr|det",
  "ich|pron",
  "du|pron",
  "er|pron",
  "sie|pron",
  "es|pron",
  "wir|pron",
  "ihr|pron",
  "Sie|pron",
  "sich|pron",
  "was|pron",
  "sein|verb",
  "haben|verb",
  "werden|verb",
  "essen|verb",
  "Essen|noun",
  "gehen|verb",
  "kommen|verb",
  "rufen|verb",
  "anrufen|verb",
  "aufstehen|verb",
  "meinen|verb",
  "geben|verb",
  "warten|verb",
  "vergessen|verb",
  "heute|adv",
  "morgen|adv",
  "hier|adv",
  "nicht|adv",
  "weil|conj",
  "und|conj",
  "dass|conj",
  "wenn|conj",
  "in|prep",
  "an|prep",
  "zu|prep",
  "auf|prep",
  "mit|prep",
  "bei|prep",
  "von|prep",
  "um|prep",
  "Kind|noun",
  "Zimmer|noun",
  "Tisch|noun",
  "Haus|noun",
  "Weg|noun",
  "weg|adv",
  "Arbeit|noun",
  "Platz|noun",
  "Schule|noun",
  "Hund|noun",
  "Buch|noun",
  "Frau|noun",
  "Bus|noun",
  "Uhr|noun",
  "gut|adj",
  "schön|adj",
  "klein|adj",
  "lang|adj",
  "sieben|num",
];

let W: WordLookup;
beforeAll(() => {
  W = makeWords(BANK);
});

const lemma = (text: string, surface: string, nth = 0) => tok(run(text, W), surface, nth).w?.lemma;

describe("lemmatizer: inflected forms", () => {
  it.each([
    ["Was hast du heute gegessen?", "gegessen", "essen"],
    ["Er ging nach Hause.", "ging", "gehen"],
    ["Ich bin hier.", "bin", "sein"],
    ["Du hast ein Buch.", "hast", "haben"],
    ["Die Kinder spielen.", "Kinder", "Kind"],
    ["Die Häuser sind alt.", "Häuser", "Haus"],
    ["Das ist besser.", "besser", "gut"],
    ["Ein schönes Haus.", "schönes", "schön"],
    ["Wir wurden müde.", "wurden", "werden"],
    ["Den Kindern geht es gut.", "Kindern", "Kind"],
  ])("%s: %s -> %s", (text, surface, expected) => {
    expect(lemma(text, surface)).toBe(expected);
  });

  it("links forms to the word bank word", () => {
    const a = run("Was hast du heute gegessen?", W);
    expect(tok(a, "gegessen").w?.wid).toBe(W.byKey("essen|verb")!.id);
    expect(tok(a, "hast").w?.wid).toBe(W.byKey("haben|verb")!.id);
  });

  it("gives verbs the infinitive meaning as gloss", () => {
    const a = run("Was hast du heute gegessen?", W);
    expect(tok(a, "gegessen").w?.gloss).toBe("to eat");
  });

  it("counts every form of an article family as the same word", () => {
    const a = run("Der Mann gibt dem Kind den Tisch des Hauses.", W);
    const der = W.byKey("der|art")!.id;
    for (const s of ["Der", "dem", "den", "des"]) expect(tok(a, s).w?.wid).toBe(der);
  });

  it("glosses each pronoun form precisely", () => {
    const a = run("Gib mir das Buch, ich gebe dir den Hund.", W);
    expect(tok(a, "mir").w?.lemma).toBe("ich");
    expect(tok(a, "mir").w?.gloss).toBe("(to) me");
    expect(tok(a, "dir").w?.lemma).toBe("du");
  });
});

describe("lemmatizer: contractions and clitics", () => {
  it.each([
    ["im", "in"],
    ["zum", "zu"],
    ["zur", "zu"],
    ["ins", "in"],
    ["beim", "bei"],
    ["vom", "von"],
    ["am", "an"],
  ])("%s = %s + article", (contraction, prep) => {
    const a = run(`Er ist ${contraction} Haus.`, W);
    const t = tok(a, contraction);
    expect(t.pt).toBe("contraction");
    expect(t.parts?.map((p) => p.lemma)).toEqual([prep, "der"]);
  });

  it("glosses contractions as preposition + article", () => {
    expect(tok(run("Ich bin im Haus.", W), "im").gloss).toBe("in the");
  });

  it("splits clitic 's into verb + es", () => {
    const t = tok(run("Wie geht's?", W), "geht's");
    expect(t.pt).toBe("clitic");
    expect(t.parts?.map((p) => p.lemma)).toEqual(["gehen", "es"]);
  });
});

describe("separable verbs", () => {
  it("joins the particle at the end of the clause to its verb", () => {
    const a = run("Ich rufe dich morgen an.", W);
    const rufe = tok(a, "rufe");
    const an = tok(a, "an");
    expect(rufe.w?.lemma).toBe("anrufen");
    expect(an.w?.lemma).toBe("anrufen");
    expect(rufe.grp).toBeDefined();
    expect(rufe.grp).toBe(an.grp);
    expect(rufe.role).toBe("verb");
    expect(an.role).toBe("particle");
    expect(rufe.w?.wid).toBe(W.byKey("anrufen|verb")!.id);
  });

  it("works in questions, imperatives and before a comma", () => {
    expect(lemma("Rufst du mich morgen an?", "Rufst")).toBe("anrufen");
    expect(lemma("Ruf mich an!", "Ruf")).toBe("anrufen");
    expect(lemma("Ich rufe dich an, wenn ich Zeit habe.", "rufe")).toBe("anrufen");
  });

  it("ends the clause at und", () => {
    const a = run("Ich stehe um sieben Uhr auf und gehe zur Schule.", W);
    expect(tok(a, "stehe").w?.lemma).toBe("aufstehen");
    expect(tok(a, "auf").grp).toBe(tok(a, "stehe").grp);
    expect(tok(a, "gehe").w?.lemma).toBe("gehen");
    expect(tok(a, "gehe").grp).toBeUndefined();
  });

  it("keeps joined forms in subordinate clauses", () => {
    const a = run("Ich warte, weil ich dich anrufe.", W);
    expect(tok(a, "anrufe").w?.lemma).toBe("anrufen");
    expect(tok(a, "anrufe").grp).toBeUndefined();
  });

  it("handles zu-infinitives and participles", () => {
    expect(lemma("Ich vergesse nicht, dich anzurufen.", "anzurufen")).toBe("anrufen");
    expect(lemma("Ich habe dich angerufen.", "angerufen")).toBe("anrufen");
  });

  it("does not join a preposition that is not at the end", () => {
    const a = run("Ich warte auf den Bus.", W);
    expect(tok(a, "auf").w?.lemma).toBe("auf");
    expect(tok(a, "auf").grp).toBeUndefined();
  });

  it("gives a separable verb that is not in the word bank its parts", () => {
    const a = run("Ich komme mit.", W);
    const komme = tok(a, "komme");
    expect(komme.w?.lemma).toBe("mitkommen");
    expect(komme.w?.wid).toBeUndefined();
    expect(komme.parts?.map((p) => p.lemma).sort()).toEqual(["kommen", "mit"]);
  });
});

describe("compounds", () => {
  it("splits a compound that is not in the word bank into word bank words", () => {
    const t = tok(run("Das Kinderzimmer ist klein.", W), "Kinderzimmer");
    expect(t.pt).toBe("compound");
    expect(t.parts?.map((p) => p.lemma)).toEqual(["Kind", "Zimmer"]);
    expect(t.w?.gloss).toMatch(/room/);
  });

  it("allows linking elements", () => {
    const t = tok(run("Mein Arbeitsplatz ist hier.", W), "Arbeitsplatz");
    expect(t.parts?.map((p) => p.lemma)).toEqual(["Arbeit", "Platz"]);
  });

  it("glosses an unknown compound from its parts", () => {
    const t = tok(run("Das Hundebuch ist schön.", W), "Hundebuch");
    expect(t.parts?.map((p) => p.lemma)).toEqual(["Hund", "Buch"]);
    expect(t.w?.gloss).toContain("+");
  });

  it("does not split words that are in the word bank", () => {
    const t = tok(run("Das Zimmer ist klein.", W), "Zimmer");
    expect(t.pt).toBeUndefined();
    expect(t.w?.wid).toBe(W.byKey("Zimmer|noun")!.id);
  });
});

describe("ambiguous words and context rules", () => {
  it("sein: possessive before a noun, verb otherwise", () => {
    expect(tok(run("Das ist sein Hund.", W), "sein").w?.wid).toBe(W.byKey("sein|det")!.id);
    expect(tok(run("Das ist sein kleiner Hund.", W), "sein").w?.wid).toBe(W.byKey("sein|det")!.id);
    expect(tok(run("Er will hier sein.", W), "sein").w?.wid).toBe(W.byKey("sein|verb")!.id);
  });

  it("Weg vs weg", () => {
    expect(tok(run("Der Weg ist lang.", W), "Weg").w?.wid).toBe(W.byKey("Weg|noun")!.id);
    expect(tok(run("Er ist weg.", W), "weg").w?.wid).toBe(W.byKey("weg|adv")!.id);
  });

  it("Essen vs essen, also at the start of a sentence", () => {
    expect(tok(run("Das Essen ist gut.", W), "Essen").w?.wid).toBe(W.byKey("Essen|noun")!.id);
    expect(tok(run("Wir essen heute.", W), "essen").w?.wid).toBe(W.byKey("essen|verb")!.id);
    expect(tok(run("Essen ist gut.", W), "Essen").w?.wid).toBe(W.byKey("Essen|noun")!.id);
    expect(tok(run("Essen wir heute?", W), "Essen").w?.wid).toBe(W.byKey("essen|verb")!.id);
  });

  it("Sie vs sie", () => {
    expect(tok(run("Kommen Sie morgen?", W), "Sie").w?.wid).toBe(W.byKey("Sie|pron")!.id);
    expect(tok(run("Ich glaube, sie kommt.", W), "sie").w?.wid).toBe(W.byKey("sie|pron")!.id);
    expect(tok(run("Sie ist hier.", W), "Sie").w?.wid).toBe(W.byKey("sie|pron")!.id);
    expect(tok(run("Sie kommen morgen.", W), "Sie").w?.wid).toBe(W.byKey("sie|pron")!.id);
    // formal text: a sentence-initial Sie is formal too
    expect(tok(run("Haben Sie Zeit? Sie kommen morgen.", W), "Sie", 1).w?.wid).toBe(W.byKey("Sie|pron")!.id);
  });

  it("ihr: you (all), her/their, or (to) her", () => {
    expect(tok(run("Ihr seid hier.", W), "Ihr").w?.wid).toBe(W.byKey("ihr|pron")!.id);
    expect(tok(run("Das ist ihr Hund.", W), "ihr").w?.wid).toBe(W.byKey("ihr|det")!.id);
    const dat = tok(run("Ich gebe ihr das Buch.", W), "ihr");
    expect(dat.w?.wid).toBe(W.byKey("sie|pron")!.id);
    expect(dat.w?.gloss).toBe("(to) her");
  });

  it("meine: possessive or the verb meinen", () => {
    expect(tok(run("Das ist meine Frau.", W), "meine").w?.wid).toBe(W.byKey("mein|det")!.id);
    expect(tok(run("Ich meine, dass es gut ist.", W), "meine").w?.wid).toBe(W.byKey("meinen|verb")!.id);
  });

  it("der/die/das: article or pronoun gloss", () => {
    expect(tok(run("Der Hund ist klein.", W), "Der").gloss).toBe("the");
    expect(tok(run("Das ist gut.", W), "Das").gloss).toBe("that, this");
  });
});

describe("capitalisation at the start of a sentence", () => {
  it("finds lowercase words written with a capital letter", () => {
    expect(tok(run("Heute gehe ich.", W), "Heute").w?.wid).toBe(W.byKey("heute|adv")!.id);
    expect(tok(run("Gut, und du?", W), "Gut").w?.wid).toBe(W.byKey("gut|adj")!.id);
    expect(tok(run("Morgen komme ich.", W), "Morgen").w?.wid).toBe(W.byKey("morgen|adv")!.id);
  });
});

describe("punctuation, numbers, names, English", () => {
  it("passes them through", () => {
    const a = run("Anna kommt um 20:15 Uhr. I love you!", W);
    expect(tok(a, "Anna").name).toBe(true);
    expect(tok(a, "20:15").k).toBe("n");
    expect(tok(a, ".").k).toBe("p");
    expect(tok(a, "love").foreign).toBe(true);
    expect(tok(a, "you").foreign).toBe(true);
    expect(a.tokens.map((t) => t.t).join("")).toBe(a.text);
  });
});

describe("gender colours", () => {
  it("colours nouns and their articles", () => {
    const a = run("Der Tisch, die Frau und das Haus.", W);
    expect(tok(a, "Der").gc).toBe("m");
    expect(tok(a, "Tisch").gc).toBe("m");
    expect(tok(a, "die").gc).toBe("f");
    expect(tok(a, "Frau").gc).toBe("f");
    expect(tok(a, "das").gc).toBe("n");
    expect(tok(a, "Haus").gc).toBe("n");
  });

  it("uses the plural colour for plural nouns and reaches the article over adjectives", () => {
    const a = run("Die Kinder haben einen kleinen Hund.", W);
    expect(tok(a, "Kinder").gc).toBe("pl");
    expect(tok(a, "Die").gc).toBe("pl");
    expect(tok(a, "einen").gc).toBe("m");
  });
});

describe("analysis is independent of the learned set", () => {
  it("is deterministic", () => {
    const a1 = run("Ich rufe dich morgen an.", W);
    const a2 = run("Ich rufe dich morgen an.", W);
    expect(a1).toEqual(a2);
    expect(wordsOf(a1).length).toBe(5);
  });

  it("uses the learned word ids helper", () => {
    expect(ids(W, "ich|pron", "du|pron").size).toBe(2);
  });
});
