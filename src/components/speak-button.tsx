"use client";

import { useSpeech } from "./use-speech";
import { IconSpeaker } from "./icons";

export function SpeakButton({
  text,
  className = "",
  label = "Play audio",
  rate,
  pitch,
}: {
  text: string;
  className?: string;
  label?: string;
  rate?: number;
  pitch?: number;
}) {
  const { speak, silent } = useSpeech();
  if (silent) return null;
  return (
    <button
      type="button"
      className={`btn btn-sm ${className}`}
      onClick={() => speak(text, { rate, pitch })}
      aria-label={`${label}: ${text}`}
      title={label}
    >
      <IconSpeaker size={18} />
    </button>
  );
}
