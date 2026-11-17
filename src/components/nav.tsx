"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppState } from "./app-state";
import type { GlossMode } from "@/lib/settings";
import {
  IconChats,
  IconGloss,
  IconMute,
  IconPlay,
  IconProgress,
  IconSettings,
  IconSpeaker,
  IconToday,
  IconWords,
} from "./icons";

const NAV = [
  { href: "/", label: "Today", Icon: IconToday },
  { href: "/words", label: "Words", Icon: IconWords },
  { href: "/progress", label: "Progress", Icon: IconProgress },
  { href: "/chats", label: "Chats", Icon: IconChats },
  { href: "/play", label: "Play", Icon: IconPlay },
  { href: "/settings", label: "Settings", Icon: IconSettings },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" || pathname.startsWith("/session") : pathname.startsWith(href);
}

const GLOSS_LABEL: Record<GlossMode, string> = {
  unlearned: "Glosses: new words",
  all: "Glosses: all words",
  none: "Glosses: off",
};
const NEXT_GLOSS: Record<GlossMode, GlossMode> = { unlearned: "all", all: "none", none: "unlearned" };

export function Header() {
  const pathname = usePathname();
  const { settings, setGlossMode, device, setDevice } = useAppState();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2">
        <Link href="/" className="mr-2 flex items-center gap-2 font-bold tracking-tight" aria-label="German Teacher, home">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-sm font-black text-accent-text">
            De
          </span>
          <span className="hidden sm:inline">German Teacher</span>
        </Link>
        <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="Main">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`rounded-lg px-3 py-1.5 text-[0.95rem] font-medium ${
                isActive(pathname, href) ? "bg-accent-soft text-accent" : "text-muted hover:text-text"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => setGlossMode(NEXT_GLOSS[settings.glossMode])}
            title={`${GLOSS_LABEL[settings.glossMode]} (click to change)`}
            aria-label={`${GLOSS_LABEL[settings.glossMode]}. Click to change.`}
            data-testid="gloss-toggle"
          >
            <IconGloss size={20} />
            <span className="text-xs">
              {settings.glossMode === "unlearned" ? "New" : settings.glossMode === "all" ? "All" : "Off"}
            </span>
          </button>
          <button
            type="button"
            className={`btn btn-sm ${device.silent ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setDevice({ silent: !device.silent })}
            aria-pressed={device.silent}
            title={device.silent ? "Silent mode is on: no sound anywhere" : "Silent mode is off"}
            aria-label="Silent mode"
            data-testid="silent-toggle"
          >
            {device.silent ? <IconMute size={20} /> : <IconSpeaker size={20} />}
            <span className="hidden text-xs sm:inline">{device.silent ? "Silent" : "Sound"}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur md:hidden"
      aria-label="Main"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-lg grid-cols-6">
        {NAV.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex flex-col items-center gap-0.5 py-2 text-[0.68rem] font-medium ${
                  active ? "text-accent" : "text-muted"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={22} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
