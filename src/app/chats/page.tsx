import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { listConversations } from "@/lib/server/chat";
import { NewFreeChat } from "./new-free-chat";

export const metadata: Metadata = { title: "Chats" };

function formatDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

async function List() {
  await connection();
  const convs = listConversations();
  if (!convs.length) return <p className="text-muted">No conversations yet. Your daily chats will appear here.</p>;
  const byDay = new Map<string, typeof convs>();
  for (const c of convs) byDay.set(c.day, [...(byDay.get(c.day) ?? []), c]);
  return (
    <div className="space-y-5">
      {[...byDay.entries()].map(([day, list]) => (
        <section key={day} className="space-y-2">
          <h2 className="text-sm font-semibold text-muted">{formatDay(day)}</h2>
          <ul className="space-y-2">
            {list.map((c) => (
              <li key={c.id}>
                <Link href={`/chats/${c.id}`} className="card block p-4 hover:bg-surface-2" data-testid="chat-link">
                  <span className="flex items-center gap-2">
                    <span className="font-semibold">{c.topic.en}</span>
                    <span className="chip">{c.kind === "daily" ? "daily" : "free chat"}</span>
                    <span className="ml-auto text-xs text-muted">
                      {c.messages} messages{c.cost > 0 ? ` · ≈ $${c.cost.toFixed(4)}` : ""}
                    </span>
                  </span>
                  <span className="mt-1 block truncate text-muted" lang="de">
                    {c.first}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default function ChatsPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Chats</h1>
        <NewFreeChat />
      </div>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <List />
      </Suspense>
    </div>
  );
}
