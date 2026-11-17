import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { MISSION_BY_ID } from "@/lib/game/missions";
import { CHARACTER_BY_ID } from "@/lib/game/characters";
import { keyWords } from "@/lib/server/game";
import { getDb } from "@/lib/server/db";
import { MissionPlayer } from "./mission-player";

export const metadata: Metadata = { title: "City Adventures" };

async function Content({ params }: { params: Promise<{ missionId: string }> }) {
  await connection();
  const { missionId } = await params;
  const mission = MISSION_BY_ID.get(missionId);
  if (!mission) notFound();
  const active = getDb()
    .prepare("SELECT id FROM game_sessions WHERE mission_id = ? AND finished = 0 ORDER BY id DESC")
    .get(missionId) as { id: number } | undefined;
  const best = getDb().prepare("SELECT best_stars FROM game_progress WHERE mission_id = ?").get(missionId) as
    | { best_stars: number }
    | undefined;
  return (
    <MissionPlayer
      mission={mission}
      cast={mission.cast.map((c) => CHARACTER_BY_ID.get(c)!)}
      keyWords={keyWords(mission)}
      activeSessionId={active?.id ?? null}
      bestStars={best?.best_stars ?? 0}
    />
  );
}

export default function MissionPage({ params }: PageProps<"/play/[missionId]">) {
  return (
    <div className="space-y-3">
      <Link href="/play" className="text-sm text-muted hover:text-text">
        ← City Adventures
      </Link>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}
