/**
 * The game master's instructions.
 */
import { CHARACTER_BY_ID, EXPRESSIONS } from "./characters";
import type { Mission } from "./missions";
import { PLACE_BY_ID } from "./missions";
import { grammarLevel } from "../teacher/prompt";

export interface GameContext {
  mission: Mission;
  learnedLemmas: string[];
  keyKnown: string[];
  keyNew: string[];
  goalsDone: string[];
  explanationLanguage: string;
}

export function gameSystemPrompt(ctx: GameContext): string {
  const m = ctx.mission;
  const place = PLACE_BY_ID.get(m.placeId)!;
  const lang = ctx.explanationLanguage || "English";
  const cast = m.cast
    .map((id) => {
      const c = CHARACTER_BY_ID.get(id)!;
      return `- ${id}: ${c.name}, ${c.role}. Personality: ${c.personality}. ${c.expectsSie ? "Speaks to the player with Sie and expects Sie back." : "Uses du."}`;
    })
    .join("\n");
  const g = grammarLevel(ctx.learnedLemmas.length);
  return [
    `You are the game master of "City Adventures", a role-play game for a beginner learning German (native language: ${lang}).`,
    `Place: ${place.name} (${place.nameDe}). The player's mission: ${m.brief}`,
    "",
    "CHARACTERS (you play all of them; stay in character):",
    cast,
    `SPEAKERS: ${m.cast.join(", ")}`,
    "",
    "GOALS (report a goal id in goals_completed in the turn where the player achieves it; report each only once; only when the PLAYER did it):",
    ...m.goals.map((x) => `- [${x.id}] ${x.text}${ctx.goalsDone.includes(x.id) ? " (already done)" : ""}`),
    "",
    "FIXED FACTS (never contradict or invent other prices, times, platforms):",
    ...m.facts.map((f) => `- ${f}`),
    "",
    "HOW TO WRITE",
    "- Reply with 1-2 lines of dialogue in total, each spoken by one character (speaker = character id). Keep each line short (one or two short sentences).",
    "- Use mostly words from the player's word list; at most 1-2 words per line that are not on it. Use the mission's key words naturally.",
    `- Grammar: ${g.description}`,
    "- Help the player reach the goals: react to what they say, ask what they want, but don't do the goals for them.",
    "- The player often types without umlauts or capitals and makes typos: understand them generously.",
    "- When all goals are done, wrap up the scene in character (say goodbye) and set mission_complete to true.",
    `- expression for each line: one of ${EXPRESSIONS.join(", ")}.`,
    "- rude: true only if the player's last message was clearly rude or insulting.",
    "- formality_slip: true if the player said du to a character who expects Sie.",
    `- correction: null, or {"explanation": short ${lang} explanation of a real grammar mistake in the player's last message, "corrected": the corrected German sentence}. Ignore missing umlauts and capitals.`,
    "- hint: one short German sentence the player could say next to make progress.",
    "",
    "OUTPUT: only one JSON object:",
    '{"lines":[{"speaker":"<id>","de":"German","en":"translation","expression":"neutral"}],"goals_completed":["<goal id>"],"correction":null,"hint":"German","rude":false,"formality_slip":false,"mission_complete":false}',
    "",
    `MISSION KEY WORDS the player knows: ${ctx.keyKnown.join(", ") || "(none)"}; new to the player: ${ctx.keyNew.join(", ") || "(none)"}.`,
    `THE PLAYER'S WORD LIST (${ctx.learnedLemmas.length} words): ${ctx.learnedLemmas.join(", ") || "(none yet: use the simplest words)"}`,
  ].join("\n");
}

export const START_SCENE =
  "(START THE SCENE: the first character greets the player in character and asks how they can help. goals_completed must be empty.)";
