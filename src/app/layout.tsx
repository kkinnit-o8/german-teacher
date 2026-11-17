import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import "./globals.css";
import { AppStateProvider } from "@/components/app-state";
import { BottomNav, Header } from "@/components/nav";
import { getSettings } from "@/lib/server/settings";
import { learnedIds } from "@/lib/server/progress";

export const metadata: Metadata = {
  title: { default: "German Teacher", template: "%s · German Teacher" },
  description: "Learn German every day: review, new words, a quick check and a chat with your AI teacher.",
  applicationName: "German Teacher",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#15171c" },
  ],
};

// Runs before the first paint: applies the saved theme so there is no flash.
const THEME_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem("gt-device")||"{}");if(p.theme==="light"||p.theme==="dark")document.documentElement.setAttribute("data-theme",p.theme)}catch(e){}})()`;

async function StateLoader({ children }: { children: React.ReactNode }) {
  await connection();
  const settings = getSettings();
  const learned = learnedIds();
  return (
    <AppStateProvider initialSettings={settings} initialLearned={learned}>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-28 md:pb-12">{children}</main>
      <BottomNav />
    </AppStateProvider>
  );
}

function ShellFallback() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 text-muted" aria-busy="true">
      Loading…
    </div>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <Suspense fallback={<ShellFallback />}>
          <StateLoader>{children}</StateLoader>
        </Suspense>
      </body>
    </html>
  );
}
