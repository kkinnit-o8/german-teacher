/**
 * Teacher conversations: storage, calls to the model, words from the chat.
 */
import "server-only";
import type { Analysis } from "../german/types";
import { unlearnedWords, usedWordIds } from "../german/render";
import { complete, getModelInfo, OpenRouterError, type ChatMessage, type Usage } from "../openrouter";
import { OPENING_REQUEST, randomTopic, systemPrompt, topicById, type Topic } from "../teacher/prompt";
import { parseTeacherReply, TEACHER_SCHEMA, type Correction, type TeacherReply } from "../teacher/response";
import { analyzeText } from "./analysis";
import { now } from "./clock";
import { getDb } from "./db";
import { learnedIds } from "./progress";
import { learnedOnDay, loadDay, saveDay, today } from "./session";
import { getSettings } from "./settings";
import { getWord } from "./words";

export interface ChatMessageView {
  id: number;
  role: "user" | "teacher";
  text: string;
  translation?: string;
  correction?: Correction | null;
  hint?: string;
  /** the model's answer could not be read as JSON: shown as raw text */
  raw?: boolean;
  analysis?: Analysis;
  correctionAnalysis?: Analysis;
  hintAnalysis?: Analysis;
  createdAt: string;
}

export interface ChatWord {
  key: string;
  lemma: string;
  gloss: string;
  wordId: number | null;
  dictId: number | null;
}

export interface ConversationView {
  id: number;
  day: string;
  kind: "daily" | "free";
  topic: Topic;
  target: number;
  exchanges: number;
  model: string | null;
  cost: number;
  messages: ChatMessageView[];
  words: ChatWord[];
  /** the last user message has no teacher reply yet (a request failed) */
  pending: boolean;
}

interface ConvRow {
  id: number;
  day: string;
  kind: "daily" | "free";
  topic: string;
  model: string | null;
  target: number;
  created_at: string;
  cost: number;
  tokens_in: number;
  tokens_out: number;
}

interface MsgRow {
  id: number;
  conversation_id: number;
  role: "user" | "teacher";
  text: string;
  translation: string | null;
  correction: string | null;
  hint: string | null;
  raw: string | null;
  created_at: string;
}

const iso = () => now().toISOString();

export function createConversation(kind: "daily" | "free", topicId?: string): number {
  const topic = topicById(topicId) ?? randomTopic();
  const s = getSettings();
  const r = getDb()
    .prepare("INSERT INTO conversations (day, kind, topic, model, target, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(today(), kind, topic.id, s.model, s.exchangesPerDay, iso());
  return Number(r.lastInsertRowid);
}

function convRow(id: number): ConvRow | undefined {
  return getDb().prepare("SELECT * FROM conversations WHERE id = ?").get(id) as ConvRow | undefined;
}

function messageRows(id: number): MsgRow[] {
  return getDb().prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY id").all(id) as MsgRow[];
}

export function exchangeCount(rows: MsgRow[]): number {
  // an exchange = a learner message followed by a teacher reply
  let n = 0;
  for (let i = 0; i < rows.length; i++) if (rows[i].role === "user" && rows[i + 1]?.role === "teacher") n++;
  return n;
}

export function chatWords(id: number): ChatWord[] {
  const learned = new Set(learnedIds());
  const rows = getDb()
    .prepare("SELECT word_key, lemma, gloss, word_id, dict_id FROM seen_words WHERE source = 'chat' AND ref = ? ORDER BY rowid")
    .all(String(id)) as { word_key: string; lemma: string; gloss: string; word_id: number | null; dict_id: number | null }[];
  return rows
    .filter((r) => !(r.word_id && learned.has(r.word_id)))
    .map((r) => ({ key: r.word_key, lemma: r.lemma, gloss: r.gloss ?? "", wordId: r.word_id, dictId: r.dict_id }));
}

export function getConversation(id: number): ConversationView | null {
  const c = convRow(id);
  if (!c) return null;
  const rows = messageRows(id);
  const messages: ChatMessageView[] = rows.map((m) => {
    const v: ChatMessageView = { id: m.id, role: m.role, text: m.text, createdAt: m.created_at };
    if (m.role === "teacher") {
      v.translation = m.translation ?? "";
      v.hint = m.hint ?? "";
      v.raw = m.raw === "raw";
      v.analysis = analyzeText(m.text);
      if (v.hint) v.hintAnalysis = analyzeText(v.hint);
    } else {
      v.correction = m.correction ? (JSON.parse(m.correction) as Correction) : null;
      if (v.correction?.corrected) v.correctionAnalysis = analyzeText(v.correction.corrected);
    }
    return v;
  });
  return {
    id: c.id,
    day: c.day,
    kind: c.kind,
    topic: topicById(c.topic) ?? randomTopic(),
    target: c.target,
    exchanges: exchangeCount(rows),
    model: c.model,
    cost: c.cost,
    messages,
    words: chatWords(id),
    pending: rows.length > 0 && rows[rows.length - 1].role === "user",
  };
}

export function listConversations(): { id: number; day: string; kind: string; topic: Topic; messages: number; cost: number; first: string }[] {
  const rows = getDb()
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS n,
              (SELECT text FROM messages m WHERE m.conversation_id = c.id AND m.role = 'teacher' ORDER BY id LIMIT 1) AS first
       FROM conversations c ORDER BY c.id DESC`,
    )
    .all() as (ConvRow & { n: number; first: string | null })[];
  return rows
    .filter((r) => r.n > 0)
    .map((r) => ({ id: r.id, day: r.day, kind: r.kind, topic: topicById(r.topic) ?? randomTopic(), messages: r.n, cost: r.cost, first: r.first ?? "" }));
}

/* ------------------------------ the model ------------------------------ */

function historyFor(rows: MsgRow[]): ChatMessage[] {
  const out: ChatMessage[] = [{ role: "user", content: OPENING_REQUEST }];
  for (const m of rows) {
    if (m.role === "user") out.push({ role: "user", content: m.text });
    else
      out.push({
        role: "assistant",
        content: JSON.stringify({ reply: m.text, translation: m.translation ?? "", correction: null, hint: m.hint ?? "" }),
      });
  }
  return out;
}

async function costOf(model: string, usage: Usage | undefined): Promise<number> {
  if (!usage) return 0;
  if (typeof usage.cost === "number") return usage.cost;
  const info = await getModelInfo(model);
  const pin = Number(info?.pricing?.prompt ?? 0);
  const pout = Number(info?.pricing?.completion ?? 0);
  return (usage.prompt_tokens ?? 0) * pin + (usage.completion_tokens ?? 0) * pout;
}

/** Ask the model for the next teacher message (retries once on unreadable JSON). */
export async function teacherTurn(id: number): Promise<ConversationView> {
  const c = convRow(id);
  if (!c) throw new Error("conversation not found");
  const rows = messageRows(id);
  const settings = getSettings();
  const model = settings.model;
  const exchanges = exchangeCount(rows);
  const userTurns = rows.filter((r) => r.role === "user").length;
  const isOpening = userTurns === 0;
  const learned = learnedIds();
  const learnedLemmas = [
    ...new Set(
      learned
        .map((wid) => getWord(wid))
        .filter(Boolean)
        .map((w) => w!.lemma),
    ),
  ];
  const todayIds = learnedOnDay(c.day);
  const used = new Set<number>();
  for (const r of rows) if (r.role === "teacher") for (const u of usedWordIds(analyzeText(r.text))) used.add(u);
  const todayWords = todayIds.map((wid) => getWord(wid)).filter(Boolean);
  const ctx = {
    learnedLemmas,
    todayWords: todayWords.map((w) => w!.display),
    todayUnused: todayWords.filter((w) => !used.has(w!.id)).map((w) => w!.display),
    topic: topicById(c.topic) ?? randomTopic(),
    exchangesLeft: Math.max(0, c.target - exchanges - (isOpening ? 0 : 1)),
    isLast: !isOpening && exchanges + 1 === c.target,
    extended: !isOpening && exchanges + 1 > c.target,
    explanationLanguage: settings.explanationLanguage,
  };
  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt(ctx) }, ...historyFor(rows)];

  let parsed: TeacherReply | null = null;
  let rawText = "";
  let cost = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
    const res = await complete({
      model,
      messages:
        attempt === 0
          ? messages
          : [
              ...messages,
              { role: "assistant", content: rawText },
              { role: "user", content: "That was not valid JSON. Reply again with only the JSON object described above." },
            ],
      schema: { name: "teacher_reply", schema: TEACHER_SCHEMA as unknown as Record<string, unknown> },
      maxTokens: 700,
      temperature: 0.7,
    });
    cost += await costOf(model, res.usage);
    tokensIn += res.usage?.prompt_tokens ?? 0;
    tokensOut += res.usage?.completion_tokens ?? 0;
    rawText = res.text;
    const p = parseTeacherReply(res.text);
    if (p.ok) parsed = p.value;
  }

  const db = getDb();
  db.transaction(() => {
    if (parsed) {
      db.prepare(
        "INSERT INTO messages (conversation_id, role, text, translation, hint, raw, created_at) VALUES (?, 'teacher', ?, ?, ?, NULL, ?)",
      ).run(id, parsed.reply, parsed.translation, parsed.hint, iso());
      // the correction belongs to the learner's last message
      const lastUser = [...rows].reverse().find((r) => r.role === "user");
      if (lastUser && !isOpening) {
        db.prepare("UPDATE messages SET correction = ? WHERE id = ?").run(
          parsed.correction ? JSON.stringify(parsed.correction) : null,
          lastUser.id,
        );
      }
    } else {
      // still unreadable after a retry: show the raw text instead of failing
      const text = rawText.trim() || "(The teacher's answer was empty. Try again.)";
      db.prepare(
        "INSERT INTO messages (conversation_id, role, text, translation, hint, raw, created_at) VALUES (?, 'teacher', ?, '', '', 'raw', ?)",
      ).run(id, text.slice(0, 2000), iso());
    }
    db.prepare(
      "UPDATE conversations SET cost = cost + ?, tokens_in = tokens_in + ?, tokens_out = tokens_out + ?, model = ? WHERE id = ?",
    ).run(cost, tokensIn, tokensOut, model, id);
  })();

  // words from the chat: unlearned words the teacher used
  const replyText = parsed?.reply ?? "";
  if (replyText) recordChatWords(id, analyzeText(replyText), c.day);

  // the daily step is done once the target is reached
  const view = getConversation(id)!;
  if (c.kind === "daily") {
    const s = loadDay(c.day);
    s.chat = { conversationId: id, exchanges: view.exchanges, target: c.target };
    if (view.exchanges >= c.target && s.steps.chat === "todo") s.steps.chat = "done";
    saveDay(s);
  }
  return view;
}

function recordChatWords(id: number, a: Analysis, day: string) {
  const learned = new Set(learnedIds());
  const ins = getDb().prepare(
    `INSERT INTO seen_words (source, ref, word_key, lemma, gloss, word_id, dict_id, day)
     VALUES ('chat', ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
  );
  for (const tok of unlearnedWords(a, learned)) {
    const w = tok.pt === "contraction" ? undefined : tok.w;
    if (!w || (!w.wid && !w.dict)) continue;
    // the word's own meaning, not the gloss of this form ("du: you", not "dir: (to) you")
    const bankWord = w.wid ? getWord(w.wid) : undefined;
    const lemma = bankWord?.display ?? w.lemma;
    const gloss = bankWord?.meanings[0] ?? w.gloss ?? "";
    ins.run(String(id), `${w.lemma}|${w.pos}`, lemma, gloss, w.wid ?? null, w.dict ?? null, day);
  }
}

export function addUserMessage(id: number, text: string) {
  getDb()
    .prepare("INSERT INTO messages (conversation_id, role, text, created_at) VALUES (?, 'user', ?, ?)")
    .run(id, text.trim().slice(0, 1000), iso());
}

/** The daily conversation for a day (created on first use). */
export function dailyConversationId(day: string): number | null {
  const s = loadDay(day);
  return s.chat?.conversationId ?? null;
}

export function startDailyConversation(topicId?: string): number {
  const day = today();
  const s = loadDay(day);
  if (s.chat?.conversationId && convRow(s.chat.conversationId)) return s.chat.conversationId;
  const id = createConversation("daily", topicId);
  s.chat = { conversationId: id, exchanges: 0, target: getSettings().exchangesPerDay };
  saveDay(s);
  return id;
}

/** The user-facing message for an OpenRouter error. */
export function errorMessage(e: unknown): { message: string; kind: string } {
  if (e instanceof OpenRouterError) {
    const hints: Record<string, string> = {
      "no-key":
        "No OpenRouter API key found. Add OPENROUTER_API_KEY=... to the file .env.local in the app folder (or run start.cmd, which asks for it), then restart the app.",
      auth: "OpenRouter did not accept your API key. Check the key in .env.local and restart the app.",
      credits: "Your OpenRouter account has no credits left. Add credits on openrouter.ai, then try again.",
      "rate-limit": "OpenRouter is busy (rate limit). Wait a moment and try again.",
      network: "Could not reach OpenRouter. Check your internet connection and try again.",
      server: "OpenRouter had a problem. Try again in a moment.",
      "bad-request": "OpenRouter refused the request. Check the model name in Settings.",
    };
    return { message: `${hints[e.kind] ?? e.message}\n(${e.message})`, kind: e.kind };
  }
  return { message: (e as Error)?.message ?? "Something went wrong.", kind: "unknown" };
}
