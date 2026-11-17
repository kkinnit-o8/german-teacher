import type { Metadata } from "next";
import { QuizStep } from "./quiz-step";

export const metadata: Metadata = { title: "Quick check" };

export default function Page() {
  return <QuizStep />;
}
