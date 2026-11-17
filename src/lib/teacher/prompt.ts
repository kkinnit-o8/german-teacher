/**
 * The AI teacher's instructions. The renderer, not the model, decides what is
 * glossed; the prompt only steers the model towards words the learner knows.
 */

export interface Topic {
  id: string;
  en: string;
  de: string;
}

export const TOPICS: Topic[] = [
  { id: "food", en: "Food and drink", de: "Essen und Trinken" },
  { id: "family", en: "Family", de: "Familie" },
  { id: "hobbies", en: "Hobbies", de: "Hobbys" },
  { id: "weather", en: "The weather", de: "das Wetter" },
  { id: "shopping", en: "Shopping", de: "Einkaufen" },
  { id: "travel", en: "Travel", de: "Reisen" },
  { id: "my-day", en: "My day", de: "mein Tag" },
  { id: "weekend", en: "The weekend", de: "das Wochenende" },
  { id: "home", en: "Home", de: "Zuhause" },
  { id: "friends", en: "Friends", de: "Freunde" },
  { id: "work", en: "Work and study", de: "Arbeit und Studium" },
  { id: "sport", en: "Sport", de: "Sport" },
  { id: "music-films", en: "Music and films", de: "Musik und Filme" },
  { id: "city", en: "My town", de: "meine Stadt" },
  { id: "animals", en: "Animals", de: "Tiere" },
  { id: "health", en: "Health", de: "Gesundheit" },
  { id: "holidays", en: "Holidays and celebrations", de: "Feiertage" },
  { id: "cooking", en: "Cooking", de: "Kochen" },
];

export function topicById(id: string | undefined): Topic | undefined {
  return TOPICS.find((t) => t.id === id);
}

export function randomTopic(rnd = Math.random): Topic {
  return TOPICS[Math.floor(rnd() * TOPICS.length)];
}

export interface GrammarLevel {
  level: number;
  /** learned words needed */
  minWords: number;
  description: string;
}

/** Grammar grows with the vocabulary. */
export const GRAMMAR_LEVELS: GrammarLevel[] = [
  {
    level: 1,
    minWords: 0,
    description:
      "Only the present tense and short simple main clauses (subject-verb-object, yes/no questions, W-questions). No past tenses, no subordinate clauses, no modal constructions except 'ich möchte'.",
  },
  {
    level: 2,
    minWords: 150,
    description:
      "Present tense, the Perfekt with haben/sein, modal verbs (können, müssen, wollen, möchten, dürfen), separable verbs, and clauses joined with und/aber/oder/denn. Still no subordinate clauses.",
  },
  {
    level: 3,
    minWords: 400,
    description:
      "Everything from before plus subordinate clauses with weil, dass, wenn and ob, comparatives, and common prepositions with dative and accusative. Keep sentences short.",
  },
  {
    level: 4,
    minWords: 800,
    description:
      "Everything from before plus the Präteritum of sein, haben, the modal verbs and common verbs (war, hatte, konnte, ging, kam, sagte), reflexive verbs and simple relative clauses.",
  },
  {
    level: 5,
    minWords: 1400,
    description:
      "Natural everyday German at B1 level: all tenses, Konjunktiv II (würde, hätte, wäre, könnte), relative clauses, zu-infinitives, simple passive. Still keep messages short.",
  },
];

export function grammarLevel(learnedCount: number): GrammarLevel {
  let g = GRAMMAR_LEVELS[0];
  for (const l of GRAMMAR_LEVELS) if (learnedCount >= l.minWords) g = l;
  return g;
}

export interface TeacherContext {
  learnedLemmas: string[];
  /** today's new words (display form, e.g. "der Tisch") */
  todayWords: string[];
  /** today's new words not yet used in this conversation */
  todayUnused: string[];
  topic: Topic;
  exchangesLeft: number;
  /** the next reply ends the daily target */
  isLast: boolean;
  /** conversation continues after the daily target */
  extended: boolean;
  explanationLanguage: string;
}

export function systemPrompt(ctx: TeacherContext): string {
  const g = grammarLevel(ctx.learnedLemmas.length);
  const lang = ctx.explanationLanguage || "English";
  const lines = [
    `You are a warm, patient German teacher chatting with a complete beginner whose native language is ${lang}.`,
    `The conversation topic is: ${ctx.topic.en} (${ctx.topic.de}).`,
    "",
    "HOW TO WRITE YOUR MESSAGES",
    "- Write normal, natural German. Keep each message short: 1-2 sentences.",
    "- Address the learner with du.",
    "- Use mostly words from the learner's word list below (any inflected form is fine). Use at most 1-2 words that are not on the list per message; the app shows their meaning automatically.",
    "- End with a simple question so the learner keeps talking, except when you wrap up.",
    `- Grammar: ${g.description}`,
    ctx.todayUnused.length
      ? `- Today the learner learned these new words. Use each of them naturally at least once during the conversation; still unused: ${ctx.todayUnused.join(", ")}.`
      : ctx.todayWords.length
        ? `- Today's new words (${ctx.todayWords.join(", ")}) have all been used. Keep using them when it fits.`
        : "",
    ctx.isLast
      ? "- This is the LAST message of today's conversation: answer briefly, praise the learner, say goodbye warmly (e.g. 'Bis morgen!'). Do not ask a new question."
      : ctx.extended
        ? "- The daily conversation is complete, but the learner wants to keep chatting. Continue naturally."
        : `- ${ctx.exchangesLeft} more exchanges remain today.`,
    "",
    "THE LEARNER'S MESSAGES",
    "- The learner often types without umlauts (ae/oe/ue/ss or just a/o/u), writes nouns in lower case and makes typos. Understand them generously and never correct those spelling issues unless the spelling changes the meaning.",
    "- If the learner writes English or asks something in English, answer in simple German and help them say it in German (put that in the hint).",
    "",
    "OUTPUT: reply with one JSON object and nothing else:",
    '{"reply": German message, "translation": the reply in ' +
      lang +
      ', "correction": null or {"explanation": a short ' +
      lang +
      ' explanation of a real grammar/word mistake in the learner\'s LAST message (wrong gender, case, verb position, word order, verb form, wrong word), "corrected": the learner\'s whole sentence corrected in German}, "hint": a short example answer the learner could give, in simple German using the word list}',
    "- correction is null for the opening message and when the learner's last message was fine or only had umlaut/capitalisation/typo issues.",
    "",
    `THE LEARNER'S WORD LIST (${ctx.learnedLemmas.length} words): ${ctx.learnedLemmas.length ? ctx.learnedLemmas.join(", ") : "(none yet: use the very simplest words, the app glosses them)"}`,
  ];
  return lines.filter((l) => l !== "").join("\n").replace(/\n(HOW|THE LEARNER'S MESSAGES|OUTPUT|THE LEARNER'S WORD)/g, "\n\n$1");
}

/** The hidden user turn that asks the model to open the conversation. */
export const OPENING_REQUEST =
  "(The learner has just opened today's chat. Start the conversation with a short friendly greeting and one easy question about the topic. correction must be null.)";
