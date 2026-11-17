import type { Metadata } from "next";
import { LearnStep } from "./learn-step";

export const metadata: Metadata = { title: "Learn" };

export default function Page() {
  return <LearnStep />;
}
