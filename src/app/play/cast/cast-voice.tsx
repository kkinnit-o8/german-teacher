"use client";

import { CHARACTER_BY_ID } from "@/lib/game/characters";
import { useSpeech } from "@/components/use-speech";
import { IconSpeaker } from "@/components/icons";

const SAMPLE: Record<string, string> = {
  lena: "Hallo! Was darf es sein? Ein Kaffee?",
  jonas: "Hmm, ich weiß nicht… vielleicht eine Cola? Oder doch Tee?",
  yilmaz: "Guten Abend. Um diese Uhrzeit? Na gut.",
  becker: "Guten Abend! Einen Moment, ich komme sofort.",
  ben: "Oh, Entschuldigung! Das ist mein erster Tag.",
  schulze: "Guten Tag. Ihre Fahrkarte, bitte.",
  hilde: "Na, Schätzchen? Die Äpfel sind heute ganz frisch!",
};

export function CastVoice({ id }: { id: string }) {
  const { speak, silent } = useSpeech();
  const c = CHARACTER_BY_ID.get(id)!;
  if (silent) return null;
  return (
    <button className="btn btn-sm ml-auto" onClick={() => speak(SAMPLE[id], { pitch: c.voice.pitch, rate: c.voice.rate })}>
      <IconSpeaker size={16} /> Hear {c.name}
    </button>
  );
}
