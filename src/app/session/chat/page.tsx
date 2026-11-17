import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Conversation" };

export default function Page() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Conversation</h1>
      <p className="text-muted">The teacher chat arrives in build phase 4.</p>
      <Link href="/" className="btn">
        ← Today
      </Link>
    </div>
  );
}
