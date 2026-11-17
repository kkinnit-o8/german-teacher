import type { Metadata } from "next";
import { ReviewStep } from "./review-step";

export const metadata: Metadata = { title: "Review" };

export default function Page() {
  return <ReviewStep />;
}
