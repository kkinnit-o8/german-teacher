import type { Metadata } from "next";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="text-muted">Coming in a later build phase.</p>
    </div>
  );
}
