import type { Metadata } from "next";
import { SummaryStep } from "./summary-step";

export const metadata: Metadata = { title: "Summary" };

export default function Page() {
  return <SummaryStep />;
}
