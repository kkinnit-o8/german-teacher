"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Character, Expression } from "@/lib/game/characters";
import type { Mission } from "@/lib/game/missions";
import type { GameView, KeyWord } from "@/lib/server/game";
import type { Turn } from "@/lib/game/rules";
import { useAppState } from "@/components/app-state";
import { useSpeech } from "@/components/use-speech";
import { MIC_HELP, useSpeechInput } from "@/components/use-speech-input";
import { GermanText } from "@/components/german-text";
import { ChatInput } from "@/components/chat/chat-input";
import { MicButton } from "@/components/chat/mic-button";
import { CharacterArt } from "@/components/game/character";
import { SceneView, type SceneActor } from "@/components/game/scene";
import { IconBulb, IconCheck, IconHeart, IconPlus, IconSpeaker, IconStar, IconTranslate, IconX } from "@/components/icons";
import { genderClass } from "@/lib/words/format";

interface Props {
  mission: Mission;
  cast: Character[];
  keyWords: KeyWord[];
  activeSessionId: number | null;
  bestStars: number;
}

interface ApiError {
  message: string;
  kind: string;
}

const NAME_TAG = ["bg-accent text-accent-text", "bg-g-m text-white", "bg-g-n text-white"];

function Hearts({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-0.5 text-bad" aria-label={`${n} of 3 hearts`} data-testid="hearts" data-hearts={n}>
      {[0, 1, 2].map((i) => (
        <IconHeart key={i} size={22} filled={i < n} className={i < n ? "" : "opacity-30"} />
      ))}
    </span>
  );
}

function Stars({ n, size = 36 }: { n: number; size?: number }) {
  return (
    <span className="inline-flex gap-1 text-warn" aria-label={`${n} of 3 stars`} data-testid="stars" data-stars={n}>
      {[0, 1, 2].map((i) => (
        <IconStar key={i} size={size} filled={i < n} className={i < n ? "" : "opacity-25"} />
      ))}
    </span>
  );
}

function Briefing({ props, onStart, busy }: { props: Props; onStart: (fresh: boolean) => void; busy: boolean }) {
  const { mission, cast, keyWords, activeSessionId, bestStars } = props;
  return (
    <div className="space-y-4" data-testid="briefing">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{mission.title}</h1>
        {bestStars > 0 && <Stars n={bestStars} size={20} />}
      </div>
      <p className="text-lg">{mission.brief}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card space-y-2 p-4">
          <h2 className="font-semibold">Goals</h2>
          <ul className="space-y-1">
            {mission.goals.map((g) => (
              <li key={g.id} className="flex items-center gap-2">
                <span className="h-4 w-4 rounded border border-border" /> {g.text}
              </li>
            ))}
          </ul>
        </section>
        <section className="card space-y-2 p-4">
          <h2 className="font-semibold">Key words</h2>
          <ul className="flex flex-wrap gap-2">
            {keyWords.map((k) => (
              <li key={k.lemma} className={`chip !text-base ${k.known ? "" : "!border-accent"}`} title={k.meaning}>
                <span lang="de">{k.display}</span>
                {k.known ? (
                  <IconCheck size={14} className="text-good" aria-label="known" />
                ) : (
                  <span className="text-xs text-accent">new{k.meaning ? `: ${k.meaning}` : ""}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section className="card p-4">
        <h2 className="mb-2 font-semibold">Characters</h2>
        <div className="flex flex-wrap gap-4">
          {cast.map((c) => (
            <div key={c.id} className="flex items-center gap-3">
              <CharacterArt character={c} expression="happy" className="h-24 w-auto rounded-xl bg-surface-2" />
              <div>
                <p className="font-semibold">{c.name}</p>
                <p className="text-sm text-muted">{c.role}</p>
                <p className="text-sm">{c.expectsSie ? "Use Sie" : "du is fine"}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary min-w-40" onClick={() => onStart(false)} disabled={busy} data-testid="start-mission">
          {busy ? "Starting…" : activeSessionId ? "Resume" : "Start"}
        </button>
        {activeSessionId && (
          <button className="btn" onClick={() => onStart(true)} disabled={busy}>
            Start over
          </button>
        )}
      </div>
      <p className="text-sm text-muted">
        3 hearts of patience: English costs a heart, rudeness too, and saying du to someone who expects Sie (after one
        warning). Stars: complete the mission, lose at most one heart, use at most one hint.
      </p>
    </div>
  );
}

export function MissionPlayer(props: Props) {
  const { mission, cast } = props;
  const [game, setGame] = useState<GameView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [showTr, setShowTr] = useState(false);
  const [draft, setDraft] = useState("");
  const [talkingId, setTalkingId] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [queued, setQueued] = useState<Set<string>>(new Set());
  const { settings } = useAppState();
  const { speak, silent } = useSpeech();
  const spokenTurn = useRef(-1);
  const endRef = useRef<HTMLDivElement>(null);
  const seenTurns = useRef<number | null>(null);
  const mic = useSpeechInput({ onText: setDraft });

  const call = useCallback(async (url: string, body: unknown) => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json()) as { game?: GameView | null; error?: ApiError };
      if (j.game) setGame(j.game);
      if (j.error) setError(j.error);
      return !j.error;
    } catch {
      setError({ message: "The app's server did not answer.", kind: "network" });
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const turns = useMemo(() => game?.state.turns ?? [], [game]);
  const lastNpcIdx = turns.map((t, i) => (t.role === "npc" ? i : -1)).filter((i) => i >= 0).pop() ?? -1;
  const lastNpc = lastNpcIdx >= 0 ? (turns[lastNpcIdx] as Extract<Turn, { role: "npc" }>) : null;
  const eventsAfter = turns.slice(lastNpcIdx + 1).filter((t): t is Extract<Turn, { role: "event" }> => t.role === "event");

  const speakLines = useCallback(
    async (lines: { speaker: string; de: string }[]) => {
      for (const l of lines) {
        const c = cast.find((x) => x.id === l.speaker);
        setTalkingId(l.speaker);
        await speak(l.de, { pitch: c?.voice.pitch, rate: c?.voice.rate });
      }
      setTalkingId(null);
    },
    [cast, speak],
  );

  // after a new turn, bring the newest lines and notices into view
  useEffect(() => {
    const n = turns.length;
    const prev = seenTurns.current;
    if (prev && n > prev) endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    // a mission that just started (Start sits at the bottom of the briefing) or restarted opens at the top
    else if (n > 0 && n !== prev) window.scrollTo({ top: 0 });
    seenTurns.current = n;
  }, [turns.length]);

  // read new lines aloud with each character's voice
  useEffect(() => {
    if (!lastNpc || lastNpcIdx === spokenTurn.current || lastNpc.raw) return;
    const first = spokenTurn.current === -1 && game?.state.turns.length !== 1;
    spokenTurn.current = lastNpcIdx;
    if (first || silent || !settings.autoSpeak) return; // don't replay when resuming
    speakLines(lastNpc.lines);
  }, [lastNpc, lastNpcIdx, game, silent, settings.autoSpeak, speakLines]);

  const actors: SceneActor[] = cast.map((c) => {
    let expression: Expression = "neutral";
    for (let i = turns.length - 1; i >= 0; i--) {
      const t = turns[i];
      if (t.role === "npc") {
        const l = [...t.lines].reverse().find((x) => x.speaker === c.id);
        if (l) {
          expression = l.expression as Expression;
          break;
        }
      }
    }
    const active = lastNpc?.lines[lastNpc.lines.length - 1]?.speaker === c.id;
    return { character: c, expression, talking: talkingId === c.id, active };
  });

  if (!game) return <Briefing props={props} busy={busy} onStart={(fresh) => call("/api/game/start", { missionId: mission.id, fresh })} />;

  const s = game.state;
  const finished = s.status !== "playing";
  const send = async (text: string) => call("/api/game/say", { id: game.sessionId, text });

  return (
    <div className="space-y-4" data-testid="play-screen">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">{mission.title}</h1>
        <Hearts n={s.hearts} />
        <span className="text-sm text-muted">
          {s.goalsDone.length}/{mission.goals.length} goals · {s.hintsUsed} hint{s.hintsUsed === 1 ? "" : "s"}
        </span>
        <Link href="/play" className="btn btn-sm ml-auto" title="Your progress is kept; resume any time">
          Leave
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
        <div className="min-w-0 space-y-3">
          <SceneView placeId={mission.placeId} actors={actors} />

          {/* dialogue box */}
          {lastNpc && (
            <div className="card space-y-3 p-4" data-testid="dialogue">
              {lastNpc.lines.map((l, j) => {
                const c = cast.find((x) => x.id === l.speaker);
                const a = game.analyses[`${lastNpcIdx}:${j}`];
                return (
                  <div key={j} className="space-y-1">
                    <span className={`inline-block rounded-full px-3 py-0.5 text-sm font-semibold ${NAME_TAG[Math.max(0, cast.indexOf(c!))] ?? NAME_TAG[0]}`}>
                      {c?.name ?? l.speaker}
                    </span>
                    <div className="text-xl">{a && !lastNpc.raw ? <GermanText analysis={a} as="p" /> : <p lang="de">{l.de}</p>}</div>
                    {showTr && l.en && (
                      <p className="text-muted" data-testid="game-translation">
                        {l.en}
                      </p>
                    )}
                  </div>
                );
              })}
              {lastNpc.raw && <p className="text-xs text-warn">The game master answered in an unexpected format, shown as plain text.</p>}
              <div className="flex flex-wrap gap-1">
                <button className="btn btn-sm btn-ghost" onClick={() => setShowTr((v) => !v)} aria-pressed={showTr}>
                  <IconTranslate size={16} /> Translate
                </button>
                {!silent && (
                  <button className="btn btn-sm btn-ghost" onClick={() => speakLines(lastNpc.lines)}>
                    <IconSpeaker size={16} /> Play again
                  </button>
                )}
                {!finished && lastNpc.hint && (
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => !game.hintShown && call("/api/game/hint", { id: game.sessionId })}
                    data-testid="game-hint"
                  >
                    <IconBulb size={16} /> Hint
                  </button>
                )}
              </div>
              {game.hintShown && lastNpc.hint && !finished && (
                <p className="rounded-lg bg-surface-2 p-2" data-testid="game-hint-text">
                  <span className="text-sm text-muted">You could say: </span>
                  <span lang="de">{lastNpc.hint}</span>
                </p>
              )}
            </div>
          )}

          {eventsAfter.map((e, i) => (
            <div
              key={i}
              className={`card p-3 ${e.event.kind === "complete" ? "border-good/60 bg-good/10" : e.event.kind === "formality-warning" ? "border-warn/60 bg-warn/10" : "border-bad/60 bg-bad/10"}`}
              role="status"
              data-testid={`event-${e.event.kind}`}
            >
              {e.event.text}
            </div>
          ))}

          {error && (
            <div className="card border-bad/50 bg-bad/5 p-4" role="alert">
              <p className="whitespace-pre-wrap text-bad">{error.message}</p>
              <button className="btn btn-sm mt-2" onClick={() => call("/api/game/retry", { id: game.sessionId })} disabled={busy}>
                Try again
              </button>
            </div>
          )}

          {finished ? (
            <Results game={game} onAgain={() => call("/api/game/start", { missionId: mission.id, fresh: true })} busy={busy} />
          ) : (
            <ChatInput
              value={draft}
              onChange={setDraft}
              onSend={send}
              disabled={busy || game.pending}
              placeholder={mic.listening ? "Listening… speak German" : "Say it in German…"}
              extra={<MicButton listening={mic.listening} availability={mic.availability} onStart={() => mic.start()} onStop={mic.stop} disabled={busy} />}
              note={mic.error ?? (mic.availability === "insecure" || mic.availability === "unsupported" ? MIC_HELP[mic.availability] : undefined)}
            />
          )}
          {busy && <p className="text-sm text-muted">…</p>}
          {/* scrolled into view after each turn so the sticky message box doesn't cover the newest lines */}
          <div ref={endRef} className="scroll-mb-24 md:scroll-mb-6" aria-hidden />
        </div>

        <aside className="space-y-3">
          <section className="card space-y-2 p-4">
            <h2 className="font-semibold">Mission</h2>
            <ul className="space-y-1.5" data-testid="checklist">
              {mission.goals.map((g) => {
                const done = s.goalsDone.includes(g.id);
                return (
                  <li key={g.id} className={`flex items-start gap-2 ${done ? "text-good" : ""}`} data-done={done}>
                    <span className={`mt-1 grid h-4 w-4 shrink-0 place-items-center rounded border ${done ? "border-good bg-good text-white" : "border-border"}`}>
                      {done && <IconCheck size={12} />}
                    </span>
                    <span className={done ? "line-through decoration-good/50" : ""}>{g.text}</span>
                  </li>
                );
              })}
            </ul>
          </section>
          {game.words.length > 0 && (
            <section className="card space-y-2 p-4">
              <h2 className="font-semibold">New words</h2>
              <ul className="space-y-1.5">
                {game.words.map((w) => (
                  <li key={w.key} className="flex items-center gap-2 text-sm">
                    <span className="flex-1">
                      <span className="font-semibold" lang="de">
                        {w.lemma}
                      </span>{" "}
                      <span className="text-muted">{w.gloss}</span>
                    </span>
                    {queued.has(w.key) ? (
                      <IconCheck size={16} className="text-good" aria-label="queued for tomorrow" />
                    ) : (
                      <button
                        className="btn btn-sm !px-2"
                        title="Learn tomorrow"
                        aria-label={`Learn ${w.lemma} tomorrow`}
                        onClick={async () => {
                          const r = await fetch("/api/queue", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(w.wordId ? { wid: w.wordId, source: "game" } : { dict: w.dictId, source: "game" }),
                          });
                          if (r.ok) setQueued((q) => new Set(q).add(w.key));
                        }}
                      >
                        <IconPlus size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <button className="btn btn-sm w-full" onClick={() => setShowLog((v) => !v)} aria-expanded={showLog}>
            {showLog ? "Hide" : "Show"} conversation log
          </button>
        </aside>
      </div>

      {showLog && <Log game={game} cast={cast} />}
    </div>
  );
}

function Log({ game, cast }: { game: GameView; cast: Character[] }) {
  return (
    <section className="card space-y-3 p-4" data-testid="game-log">
      <h2 className="font-semibold">Conversation</h2>
      {game.state.turns.map((t, i) => {
        if (t.role === "player")
          return (
            <div key={i} className="text-right">
              <span className="inline-block rounded-2xl bg-accent px-3 py-1.5 text-accent-text" lang="de">
                {t.text}
              </span>
              {t.correction && (
                <p className="mt-1 text-sm">
                  <span className="font-semibold text-warn">Correction: </span>
                  {t.correction.explanation} {t.correction.corrected && <em lang="de">→ {t.correction.corrected}</em>}
                </p>
              )}
            </div>
          );
        if (t.role === "event")
          return (
            <p key={i} className="text-center text-sm text-muted">
              {t.event.text}
            </p>
          );
        return t.lines.map((l, j) => {
          const a = game.analyses[`${i}:${j}`];
          return (
            <div key={`${i}:${j}`}>
              <span className="text-sm font-semibold">{cast.find((c) => c.id === l.speaker)?.name ?? l.speaker}: </span>
              {a ? <GermanText analysis={a} /> : <span lang="de">{l.de}</span>}
              {l.en && <span className="block text-sm text-muted">{l.en}</span>}
            </div>
          );
        });
      })}
    </section>
  );
}

function Results({ game, onAgain, busy }: { game: GameView; onAgain: () => void; busy: boolean }) {
  const st = game.stars;
  const won = game.state.status === "won";
  const row = (ok: boolean, text: string) => (
    <li className={`flex items-center gap-2 ${ok ? "" : "text-muted"}`}>
      {ok ? <IconCheck size={18} className="text-good" /> : <IconX size={18} />} {text}
    </li>
  );
  return (
    <div className="card space-y-4 p-6 text-center" data-testid="results">
      <h2 className="text-2xl font-bold">{won ? "Mission complete!" : "Out of patience…"}</h2>
      <Stars n={st.stars} />
      <ul className="mx-auto inline-block space-y-1 text-left">
        {row(st.complete, "Mission completed")}
        {row(st.complete && st.fewHeartsLost, `Lost at most one heart (lost ${game.state.heartsLost})`)}
        {row(st.complete && st.fewHints, `Used at most one hint (used ${game.state.hintsUsed})`)}
      </ul>
      {game.cost > 0 && <p className="text-xs text-muted">≈ ${game.cost.toFixed(4)}</p>}
      <div className="flex flex-wrap justify-center gap-2">
        <button className="btn btn-primary" onClick={onAgain} disabled={busy} data-testid="play-again">
          {won ? "Play again" : "Try again"}
        </button>
        <Link href="/play" className="btn">
          Back to the city
        </Link>
      </div>
      <p className={`text-sm text-muted ${genderClass(undefined)}`}>New words from the game can be added to tomorrow’s words on the right.</p>
    </div>
  );
}
