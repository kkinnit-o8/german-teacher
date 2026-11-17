import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { gameOverview } from "@/lib/server/game";
import { CHARACTER_BY_ID } from "@/lib/game/characters";
import { SceneView } from "@/components/game/scene";
import { IconStar } from "@/components/icons";

export const metadata: Metadata = { title: "City Adventures" };

function Stars({ n, max = 3, size = 16 }: { n: number; max?: number; size?: number }) {
  return (
    <span className="inline-flex text-warn" aria-label={`${n} of ${max} stars`}>
      {Array.from({ length: max }).map((_, i) => (
        <IconStar key={i} size={size} filled={i < n} className={i < n ? "" : "text-muted opacity-40"} />
      ))}
    </span>
  );
}

async function Places() {
  await connection();
  const places = gameOverview();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {places.map((p) => {
        const castIds = [...new Set(p.missions.flatMap((m) => m.cast))];
        return (
          <section key={p.id} className="card overflow-hidden" data-testid={`place-${p.id}`}>
            <SceneView
              placeId={p.id}
              className="!rounded-none !border-0"
              actors={castIds.map((id) => ({ character: CHARACTER_BY_ID.get(id)!, expression: "neutral", talking: false, active: false }))}
            />
            <div className="space-y-3 p-4">
              <div className="flex items-baseline gap-2">
                <h2 className="text-lg font-semibold">{p.name}</h2>
                <span className="text-sm text-muted" lang="de">
                  {p.nameDe}
                </span>
                <span className="ml-auto text-sm text-muted" title="Best stars at this place">
                  <IconStar size={14} filled className="inline text-warn" /> {p.bestStars}/{p.maxStars}
                </span>
              </div>
              <p className="text-sm text-muted">{p.description}</p>
              <ul className="space-y-2">
                {p.missions.map((m) => (
                  <li key={m.id}>
                    <Link href={`/play/${m.id}`} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 hover:bg-surface-2" data-testid={`mission-${m.id}`}>
                      <span className="flex-1 font-medium">{m.title}</span>
                      {m.inProgress && <span className="chip">in progress</span>}
                      <Stars n={m.bestStars} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default function PlayPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">City Adventures</h1>
          <p className="text-muted">Talk your way through everyday places. Your daily session isn’t affected.</p>
        </div>
        <Link href="/play/cast" className="btn btn-sm ml-auto">
          Meet the cast
        </Link>
      </div>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Places />
      </Suspense>
    </div>
  );
}
