import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { wordBank } from "@/lib/server/words";

async function Overview() {
  await connection();
  const bank = wordBank();
  return (
    <div className="card space-y-2 p-5">
      <p>
        The word bank has <strong>{bank.words.length}</strong> words.
      </p>
      <Link href="/words" className="btn btn-primary">
        Browse the words
      </Link>
    </div>
  );
}

export default function TodayPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Today</h1>
      <p className="text-muted">The daily session arrives in phase 5.</p>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Overview />
      </Suspense>
    </div>
  );
}
