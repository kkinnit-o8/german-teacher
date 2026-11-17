import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Summary" };

export default function Page() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Summary</h1>
      <p className="text-muted">The daily summary arrives in build phase 5.</p>
      <Link href="/" className="btn">
        ← Today
      </Link>
    </div>
  );
}
