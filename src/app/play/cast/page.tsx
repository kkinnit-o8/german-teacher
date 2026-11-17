import type { Metadata } from "next";
import Link from "next/link";
import { CHARACTERS, EXPRESSIONS } from "@/lib/game/characters";
import { CharacterArt } from "@/components/game/character";
import { CastVoice } from "./cast-voice";

export const metadata: Metadata = { title: "Meet the cast" };

export default function CastPage() {
  return (
    <div className="space-y-4">
      <Link href="/play" className="text-sm text-muted hover:text-text">
        ← City Adventures
      </Link>
      <h1 className="text-2xl font-bold">Meet the cast</h1>
      <div className="space-y-4">
        {CHARACTERS.map((c) => (
          <section key={c.id} className="card space-y-3 p-4" data-testid="cast-member">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <h2 className="text-lg font-semibold">{c.name}</h2>
                <p className="text-sm text-muted">
                  {c.role} · {c.personality}
                </p>
              </div>
              <span className="chip">{c.expectsSie ? "expects Sie" : "du is fine"}</span>
              <CastVoice id={c.id} />
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {EXPRESSIONS.map((e) => (
                <figure key={e} className="rounded-xl bg-surface-2 p-1 text-center">
                  <CharacterArt character={c} expression={e} className="mx-auto h-36 w-auto" />
                  <figcaption className="text-xs text-muted">{e}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
