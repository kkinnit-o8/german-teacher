"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_SETTINGS, type GlossMode, type Settings } from "@/lib/settings";

export type Theme = "system" | "light" | "dark";

/** Preferences saved per device (localStorage). */
export interface DevicePrefs {
  silent: boolean;
  theme: Theme;
  ttsRate: number;
  ttsVoice: string;
  speakingMode: boolean;
}

export const DEFAULT_DEVICE: DevicePrefs = {
  silent: false,
  theme: "system",
  ttsRate: 0.9,
  ttsVoice: "",
  speakingMode: false,
};

const DEVICE_KEY = "gt-device";

interface AppState {
  settings: Settings;
  learned: Set<number>;
  device: DevicePrefs;
  hydrated: boolean;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  setDevice: (patch: Partial<DevicePrefs>) => void;
  addLearned: (ids: number[]) => void;
  setGlossMode: (m: GlossMode) => void;
}

const Ctx = createContext<AppState | null>(null);

export function readDevicePrefs(): DevicePrefs {
  try {
    const raw = localStorage.getItem(DEVICE_KEY);
    if (!raw) return DEFAULT_DEVICE;
    const p = { ...DEFAULT_DEVICE, ...JSON.parse(raw) } as DevicePrefs;
    // silent mode and speaking mode can't both be on
    if (p.silent) p.speakingMode = false;
    return p;
  } catch {
    return DEFAULT_DEVICE;
  }
}

export function applyTheme(theme: Theme) {
  const el = document.documentElement;
  if (theme === "system") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", theme);
}

export function AppStateProvider({
  initialSettings,
  initialLearned,
  children,
}: {
  initialSettings: Settings;
  initialLearned: number[];
  children: ReactNode;
}) {
  const [settings, setSettings] = useState<Settings>(initialSettings ?? DEFAULT_SETTINGS);
  const [learned, setLearned] = useState<Set<number>>(() => new Set(initialLearned));
  const [device, setDeviceState] = useState<DevicePrefs>(DEFAULT_DEVICE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // localStorage is only available after hydration
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDeviceState(readDevicePrefs());
    setHydrated(true);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("no-gender", !settings.genderColors);
  }, [settings.genderColors]);

  const setDevice = useCallback((patch: Partial<DevicePrefs>) => {
    setDeviceState((prev) => {
      const next = { ...prev, ...patch };
      if (patch.silent) next.speakingMode = false;
      if (patch.speakingMode) next.silent = false;
      try {
        localStorage.setItem(DEVICE_KEY, JSON.stringify(next));
      } catch {}
      if (patch.theme) applyTheme(next.theme);
      if (patch.silent && typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
      return next;
    });
  }, []);

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) setSettings(await res.json());
  }, []);

  const setGlossMode = useCallback((m: GlossMode) => void updateSettings({ glossMode: m }), [updateSettings]);

  const addLearned = useCallback((ids: number[]) => {
    setLearned((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ settings, learned, device, hydrated, updateSettings, setDevice, addLearned, setGlossMode }),
    [settings, learned, device, hydrated, updateSettings, setDevice, addLearned, setGlossMode],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppState outside AppStateProvider");
  return v;
}
