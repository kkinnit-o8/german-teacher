import type { Metadata } from "next";
import { DailyChat } from "./daily-chat";

export const metadata: Metadata = { title: "Conversation" };

export default function Page() {
  return <DailyChat />;
}
