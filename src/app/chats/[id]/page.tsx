import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { getConversation } from "@/lib/server/chat";
import { today } from "@/lib/server/session";
import { ChatView } from "@/components/chat/chat-view";

export const metadata: Metadata = { title: "Chat" };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const conv = getConversation(Number(id));
  if (!conv) notFound();
  // today's free chats can continue; everything else is for rereading
  const readOnly = !(conv.kind === "free" && conv.day === today());
  return (
    <div className="space-y-3">
      <Link href="/chats" className="text-sm text-muted hover:text-text">
        ← All chats
      </Link>
      <ChatView conversation={conv} readOnly={readOnly} />
    </div>
  );
}

export default function ChatPage({ params }: PageProps<"/chats/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Content params={params} />
    </Suspense>
  );
}
