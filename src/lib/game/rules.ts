/**
 * City Adventures rules, decided by code (not by the AI):
 *  - 3 hearts ("patience"). Writing English costs a heart; rudeness costs a heart.
 *  - Saying du to someone who expects Sie: the first time a frown and a tip, after
 *    that a heart.
 *  - No hearts left: the character gives up and you can try again.
 *  - Stars: 1 for completing the mission, 1 for losing at most one heart,
 *    1 for using at most one hint.
 */
import { ENGLISH_WORDS } from "../german/english";
import type { Correction } from "../teacher/response";

export const MAX_HEARTS = 3;

export interface NpcLine {
  speaker: string;
  de: string;
  en: string;
  expression: string;
}

export type GameEvent =
  | { kind: "english"; text: string }
  | { kind: "rude"; text: string }
  | { kind: "formality-warning"; text: string }
  | { kind: "formality"; text: string }
  | { kind: "gave-up"; text: string }
  | { kind: "complete"; text: string };

export type Turn =
  | { role: "player"; text: string; correction?: Correction | null }
  | { role: "npc"; lines: NpcLine[]; hint?: string; raw?: boolean }
  | { role: "event"; event: GameEvent };

export interface GameState {
  missionId: string;
  hearts: number;
  heartsLost: number;
  hintsUsed: number;
  formalityWarned: boolean;
  goalsDone: string[];
  status: "playing" | "won" | "lost";
  turns: Turn[];
}

export function newGame(missionId: string): GameState {
  return {
    missionId,
    hearts: MAX_HEARTS,
    heartsLost: 0,
    hintsUsed: 0,
    formalityWarned: false,
    goalsDone: [],
    status: "playing",
    turns: [],
  };
}

const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .split(/[^a-zäöüß']+/i)
    .map((w) => w.replace(/^'+|'+$/g, ""))
    .filter(Boolean);

/**
 * Did the player write English? Clear cases only (benefit of the doubt):
 * at least two English words, most of the message English, at most one German word.
 * `isGerman` says whether a word is a German word form (dictionary lookup).
 */
export function isEnglish(text: string, isGerman: (w: string) => boolean): boolean {
  const toks = words(text);
  if (toks.length < 2) return false;
  // words that are both English and German ("a", "so", "ticket") are neutral
  let englishOnly = 0;
  let both = 0;
  let germanOnly = 0;
  for (const t of toks) {
    const en = ENGLISH_WORDS.has(t) && !/[äöüß]/.test(t);
    const de = /[äöüß]/.test(t) || isGerman(t);
    if (en && de) both++;
    else if (en) englishOnly++;
    else if (de) germanOnly++;
  }
  return englishOnly >= 2 && englishOnly + both >= 0.6 * toks.length && germanOnly <= 1;
}

const DU = /\b(du|dich|dir|dein|deine|deinen|deinem|deiner|deines|dein's)\b/i;
const DU_IMPERATIVE = /^\s*(gib|nimm|sag|zeig|hilf|mach|warte|komm|hör|schau|guck)\b/i;
const SIE = /\b(sie|ihnen)\b/i;

export function usesDu(text: string): boolean {
  return DU.test(text) || DU_IMPERATIVE.test(text);
}

export function usesSie(text: string): boolean {
  return SIE.test(text);
}

/** A du to someone who expects Sie. The game master's flag only counts when the code sees a du-form too. */
export function isFormalitySlip(text: string, expectsSie: boolean, aiFlag = false): boolean {
  if (!expectsSie || usesSie(text)) return false;
  return usesDu(text) || (aiFlag && DU_IMPERATIVE.test(text));
}

const INSULTS = /\b(idiot|blöd|blöde[rnms]?|dumm(kopf)?|halt die klappe|scheiße|scheisse|arsch|depp|trottel)\b/i;

export function isRude(text: string, aiFlag: boolean): boolean {
  return aiFlag || INSULTS.test(text);
}

export interface TurnInput {
  text: string;
  english: boolean;
  rude: boolean;
  formalitySlip: boolean;
  goalsCompleted: string[];
  allGoals: string[];
}

/** Apply the rules for one player turn (the NPC lines are added by the caller). */
export function applyTurn(state: GameState, input: TurnInput): { state: GameState; events: GameEvent[] } {
  const s: GameState = { ...state, goalsDone: [...state.goalsDone], turns: [...state.turns] };
  const events: GameEvent[] = [];
  const lose = () => {
    if (s.hearts > 0) {
      s.hearts--;
      s.heartsLost++;
    }
  };
  if (input.english) {
    lose();
    events.push({ kind: "english", text: "That was English. Try to say it in German: the hint button helps." });
  }
  if (input.rude) {
    lose();
    events.push({ kind: "rude", text: "That was rude. Being polite in German: bitte, danke, Entschuldigung." });
  }
  if (input.formalitySlip) {
    if (!s.formalityWarned) {
      s.formalityWarned = true;
      events.push({
        kind: "formality-warning",
        text: "Tip: this person expects Sie, not du. Say “Können Sie …?”, “Haben Sie …?”, “Ihnen”.",
      });
    } else {
      lose();
      events.push({ kind: "formality", text: "du again! This person expects Sie." });
    }
  }
  for (const g of input.goalsCompleted) if (input.allGoals.includes(g) && !s.goalsDone.includes(g)) s.goalsDone.push(g);
  if (s.hearts <= 0) {
    s.status = "lost";
    events.push({ kind: "gave-up", text: "Out of patience! The character gave up. Try again?" });
  } else if (input.allGoals.every((g) => s.goalsDone.includes(g))) {
    s.status = "won";
    events.push({ kind: "complete", text: "Mission complete!" });
  }
  return { state: s, events };
}

export interface StarResult {
  stars: number;
  complete: boolean;
  fewHeartsLost: boolean;
  fewHints: boolean;
}

export function computeStars(s: Pick<GameState, "status" | "heartsLost" | "hintsUsed">): StarResult {
  const complete = s.status === "won";
  const fewHeartsLost = s.heartsLost <= 1;
  const fewHints = s.hintsUsed <= 1;
  return { stars: complete ? 1 + Number(fewHeartsLost) + Number(fewHints) : 0, complete, fewHeartsLost, fewHints };
}
