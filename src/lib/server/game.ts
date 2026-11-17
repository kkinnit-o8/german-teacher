/**
 * City Adventures on the server: sessions, calls to the game master, rules.
 */
import "server-only";
import type { Analysis } from "../german/types";
import { unlearnedWords } from "../german/render";
import { CHARACTER_BY_ID, type Character } from "../game/characters";
import { MISSIONS, MISSION_BY_ID, PLACES, type Mission } from "../game/missions";
import { gameSystemPrompt, START_SCENE } from "../game/prompt";
import { GAME_SCHEMA, parseGameReply, type GameReply } from "../game/response";
import {
  applyTurn,
  computeStars,
  isEnglish,
  isFormalitySlip,
  isRude,
  newGame,
  type GameState,
  type NpcLine,
  type StarResult,
} from "../game/rules";
import { complete, type ChatMessage } from "../openrouter";
import { analyzeText, sqliteLexicon } from "./analysis";
import { ENGLISH_WORDS } from "../german/english";
import { now } from "./clock";
import { getDb } from "./db";
import { learnedIds } from "./progress";
import { getSettings } from "./settings";
import { today } from "./session";
import { getWord, wordIndex } from "./words";

const iso = () => now().toISOString();

export interface KeyWord {
  lemma: string;
  display: string;
  meaning: string;
  wordId: number | null;
  known: boolean;
}

export interface GameView {
  sessionId: number;
  mission: Mission;
  cast: Character[];
  state: GameState;
  stars: StarResult;
  /** analyses of every NPC line, keyed "turnIndex:lineIndex" */
  analyses: Record<string, Analysis>;
  /** the last NPC turn's hint has been revealed */
  hintShown: boolean;
  pending: boolean;
  cost: number;
  words: { key: string; lemma: string; gloss: string; wordId: number | null; dictId: number | null }[];
}

interface SessionRow {
  id: number;
  mission_id: string;
  state: string;
  finished: number;
  cost: number;
}

interface StoredState extends GameState {
  hintShownForTurn?: number;
  /** raw JSON of each NPC turn, for the model's history */
  history?: string[];
}

function missionOrThrow(id: string): Mission {
  const m = MISSION_BY_ID.get(id);
  if (!m) throw new Error("Unknown mission");
  return m;
}

export function keyWords(m: Mission): KeyWord[] {
  const learned = new Set(learnedIds());
  const idx = wordIndex();
  return m.keyWords.map((lemma) => {
    const w = idx.byLemma.get(lemma)?.[0];
    return {
      lemma,
      display: w?.display ?? lemma,
      meaning: w?.meanings[0] ?? "",
      wordId: w?.id ?? null,
      known: w ? learned.has(w.id) : false,
    };
  });
}

export function gameOverview() {
  const db = getDb();
  const best = new Map(
    (db.prepare("SELECT mission_id, best_stars FROM game_progress").all() as { mission_id: string; best_stars: number }[]).map(
      (r) => [r.mission_id, r.best_stars],
    ),
  );
  const active = new Map(
    (db.prepare("SELECT mission_id, id FROM game_sessions WHERE finished = 0 ORDER BY id").all() as { mission_id: string; id: number }[]).map(
      (r) => [r.mission_id, r.id],
    ),
  );
  return PLACES.map((p) => {
    const missions = MISSIONS.filter((m) => m.placeId === p.id).map((m) => ({
      id: m.id,
      title: m.title,
      brief: m.brief,
      bestStars: best.get(m.id) ?? 0,
      inProgress: active.has(m.id),
      cast: m.cast,
    }));
    return { ...p, missions, bestStars: missions.reduce((a, m) => a + m.bestStars, 0), maxStars: missions.length * 3 };
  });
}

function loadSession(id: number): { row: SessionRow; state: StoredState } {
  const row = getDb().prepare("SELECT * FROM game_sessions WHERE id = ?").get(id) as SessionRow | undefined;
  if (!row) throw new Error("Game not found");
  return { row, state: JSON.parse(row.state) };
}

function saveSession(id: number, state: StoredState, addCost = 0) {
  const finished = state.status !== "playing" ? 1 : 0;
  getDb()
    .prepare("UPDATE game_sessions SET state = ?, updated_at = ?, finished = ?, cost = cost + ? WHERE id = ?")
    .run(JSON.stringify(state), iso(), finished, addCost, id);
  if (state.status === "won") {
    const stars = computeStars(state).stars;
    getDb()
      .prepare(
        `INSERT INTO game_progress (mission_id, best_stars, completed_at) VALUES (?, ?, ?)
         ON CONFLICT(mission_id) DO UPDATE SET best_stars = MAX(best_stars, excluded.best_stars), completed_at = excluded.completed_at`,
      )
      .run(state.missionId, stars, iso());
  }
}

/** Waiting for the game master (the last request failed, or the scene hasn't started). */
function isPending(state: StoredState): boolean {
  if (state.status !== "playing") return false;
  const lastReal = [...state.turns].reverse().find((t) => t.role !== "event");
  return !lastReal || lastReal.role === "player";
}

export function gameView(id: number): GameView {
  const { row, state } = loadSession(id);
  const m = missionOrThrow(row.mission_id);
  const cast = m.cast.map((c) => CHARACTER_BY_ID.get(c)!);
  const formal = cast.some((c) => c.expectsSie);
  const analyses: Record<string, Analysis> = {};
  state.turns.forEach((t, i) => {
    if (t.role === "npc") t.lines.forEach((l, j) => (analyses[`${i}:${j}`] = analyzeText(l.de, { formal })));
  });
  const lastNpc = state.turns.map((t, i) => (t.role === "npc" ? i : -1)).filter((i) => i >= 0).pop() ?? -1;
  const learned = new Set(learnedIds());
  const words = (
    getDb()
      .prepare("SELECT word_key, lemma, gloss, word_id, dict_id FROM seen_words WHERE source = 'game' AND ref = ? ORDER BY rowid")
      .all(String(id)) as { word_key: string; lemma: string; gloss: string; word_id: number | null; dict_id: number | null }[]
  )
    .filter((w) => !(w.word_id && learned.has(w.word_id)))
    .map((w) => ({ key: w.word_key, lemma: w.lemma, gloss: w.gloss ?? "", wordId: w.word_id, dictId: w.dict_id }));
  return {
    sessionId: id,
    mission: m,
    cast,
    state: { ...state, turns: state.turns },
    stars: computeStars(state),
    analyses,
    hintShown: state.hintShownForTurn === lastNpc && lastNpc >= 0,
    pending: isPending(state),
    cost: row.cost,
    words,
  };
}

/** Start a mission, or resume the unfinished one. `fresh` starts over. */
export async function startGame(missionId: string, fresh = false): Promise<GameView> {
  const m = missionOrThrow(missionId);
  const db = getDb();
  const existing = db.prepare("SELECT id FROM game_sessions WHERE mission_id = ? AND finished = 0 ORDER BY id DESC").get(missionId) as
    | { id: number }
    | undefined;
  if (existing && !fresh) {
    const v = gameView(existing.id);
    if (v.state.turns.length) return v;
    return npcTurn(existing.id);
  }
  if (existing && fresh) db.prepare("UPDATE game_sessions SET finished = 1 WHERE id = ?").run(existing.id);
  const state: StoredState = { ...newGame(m.id), history: [] };
  const r = db
    .prepare("INSERT INTO game_sessions (mission_id, state, created_at, updated_at) VALUES (?, ?, ?, ?)")
    .run(m.id, JSON.stringify(state), iso(), iso());
  return npcTurn(Number(r.lastInsertRowid));
}

/**
 * Is this (lowercase) word German? A common English word that only matches a
 * capitalised German noun ("want" ~ Want, "i" ~ the letter I) counts as English;
 * words with a lowercase German reading ("was", "will", "die") count as German.
 */
export function isGermanWord(w: string): boolean {
  return sqliteLexicon
    .lookup(w)
    .some((h) => h.entry.p !== "name" && (h.entry.w[0] === h.entry.w[0].toLowerCase() || !ENGLISH_WORDS.has(w)));
}

/** The player says something: rules first (by code), then the game master answers. */
export async function playerSay(id: number, text: string): Promise<GameView> {
  const { state } = loadSession(id);
  if (state.status !== "playing" || isPending(state)) return gameView(id);
  const t = text.trim().slice(0, 500);
  state.turns.push({ role: "player", text: t });
  saveSession(id, state);
  return npcTurn(id);
}

/** The character the player is talking to: whoever spoke last. */
function addressee(state: GameState, m: Mission): Character {
  for (let i = state.turns.length - 1; i >= 0; i--) {
    const t = state.turns[i];
    if (t.role === "npc" && t.lines.length) return CHARACTER_BY_ID.get(t.lines[t.lines.length - 1].speaker) ?? CHARACTER_BY_ID.get(m.cast[0])!;
  }
  return CHARACTER_BY_ID.get(m.cast[0])!;
}

async function askGameMaster(state: StoredState, m: Mission): Promise<{ reply: GameReply | null; raw: string; cost: number }> {
  const learnedLemmas = [...new Set(learnedIds().map((wid) => getWord(wid)?.lemma).filter(Boolean) as string[])];
  const kws = keyWords(m);
  const system = gameSystemPrompt({
    mission: m,
    learnedLemmas,
    keyKnown: kws.filter((k) => k.known).map((k) => k.lemma),
    keyNew: kws.filter((k) => !k.known).map((k) => k.lemma),
    goalsDone: state.goalsDone,
    explanationLanguage: getSettings().explanationLanguage,
  });
  const messages: ChatMessage[] = [{ role: "system", content: system }, { role: "user", content: START_SCENE }];
  let npcIdx = 0;
  for (const t of state.turns) {
    if (t.role === "npc") messages.push({ role: "assistant", content: state.history?.[npcIdx++] ?? JSON.stringify({ lines: t.lines }) });
    if (t.role === "player") messages.push({ role: "user", content: t.text });
  }
  let raw = "";
  let cost = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await complete({
      model: getSettings().model,
      messages:
        attempt === 0
          ? messages
          : [...messages, { role: "assistant", content: raw }, { role: "user", content: "That was not valid JSON. Reply again with only the JSON object." }],
      schema: { name: "game_turn", schema: GAME_SCHEMA as unknown as Record<string, unknown> },
      maxTokens: 700,
      temperature: 0.8,
    });
    cost += res.usage?.cost ?? 0;
    raw = res.text;
    const p = parseGameReply(raw, m.cast);
    if (p.ok) return { reply: p.value, raw, cost };
  }
  return { reply: null, raw, cost };
}

async function npcTurn(id: number): Promise<GameView> {
  const { state } = loadSession(id);
  const m = missionOrThrow(state.missionId);
  const lastPlayer = [...state.turns].reverse().find((t) => t.role === "player");
  const isOpening = !state.turns.some((t) => t.role === "npc");
  const who = addressee(state, m);
  const { reply, raw, cost } = await askGameMaster(state, m);

  if (!reply) {
    // unreadable after a retry: show the raw text instead of failing
    state.turns.push({ role: "npc", lines: [{ speaker: m.cast[0], de: raw.trim().slice(0, 400) || "…", en: "", expression: "confused" }], raw: true });
    state.history = [...(state.history ?? []), raw];
    saveSession(id, state, cost);
    return gameView(id);
  }

  let next: StoredState = state;
  if (!isOpening && lastPlayer && lastPlayer.role === "player") {
    lastPlayer.correction = reply.correction;
    const english = isEnglish(lastPlayer.text, isGermanWord);
    const { state: s2, events } = applyTurn(state, {
      text: lastPlayer.text,
      english,
      rude: isRude(lastPlayer.text, reply.rude),
      formalitySlip: isFormalitySlip(lastPlayer.text, who.expectsSie, reply.formalitySlip),
      goalsCompleted: reply.goalsCompleted,
      allGoals: m.goals.map((g) => g.id),
    });
    next = { ...state, ...s2 };
    // the character reacts visibly to a slip or an English message
    const lines: NpcLine[] = reply.lines.map((l) =>
      events.some((e) => e.kind === "formality-warning" || e.kind === "formality" || e.kind === "rude") && l.speaker === who.id
        ? { ...l, expression: "annoyed" }
        : events.some((e) => e.kind === "english") && l.speaker === who.id && l.expression === "neutral"
          ? { ...l, expression: "confused" }
          : l,
    );
    if (next.status === "lost") {
      next.turns.push({
        role: "npc",
        lines: [{ speaker: who.id, de: "Tut mir leid, ich habe jetzt keine Zeit mehr. Auf Wiedersehen!", en: "Sorry, I don't have time any more. Goodbye!", expression: "annoyed" }],
      });
    } else {
      next.turns.push({ role: "npc", lines, hint: reply.hint });
    }
    for (const e of events) next.turns.push({ role: "event", event: e });
  } else {
    next.turns.push({ role: "npc", lines: reply.lines, hint: reply.hint });
  }
  next.history = [...(state.history ?? []), raw];
  saveSession(id, next, cost);
  recordGameWords(id, next);
  return gameView(id);
}

function recordGameWords(id: number, state: GameState) {
  const learned = new Set(learnedIds());
  const ins = getDb().prepare(
    `INSERT INTO seen_words (source, ref, word_key, lemma, gloss, word_id, dict_id, day)
     VALUES ('game', ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
  );
  const last = [...state.turns].reverse().find((t) => t.role === "npc");
  if (!last || last.role !== "npc" || last.raw) return;
  for (const line of last.lines) {
    for (const tok of unlearnedWords(analyzeText(line.de), learned)) {
      const w = tok.pt === "contraction" ? undefined : tok.w;
      if (!w || (!w.wid && !w.dict)) continue;
      const bw = w.wid ? getWord(w.wid) : undefined;
      ins.run(String(id), `${w.lemma}|${w.pos}`, bw?.display ?? w.lemma, bw?.meanings[0] ?? w.gloss ?? "", w.wid ?? null, w.dict ?? null, today());
    }
  }
}

/** Reveal the hint for the current turn (counts once per turn). */
export function revealHint(id: number): GameView {
  const { state } = loadSession(id);
  const lastNpc = state.turns.map((t, i) => (t.role === "npc" ? i : -1)).filter((i) => i >= 0).pop() ?? -1;
  if (lastNpc >= 0 && state.hintShownForTurn !== lastNpc && state.status === "playing") {
    state.hintShownForTurn = lastNpc;
    state.hintsUsed++;
    saveSession(id, state);
  }
  return gameView(id);
}

export async function retryGame(id: number): Promise<GameView> {
  const { state } = loadSession(id);
  if (!isPending(state)) return gameView(id);
  return npcTurn(id);
}

export function leaveGame(id: number) {
  // nothing to do: the session stays unfinished and can be resumed
  return gameView(id);
}
