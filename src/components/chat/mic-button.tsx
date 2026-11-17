"use client";

import { IconMic } from "../icons";
import { MIC_HELP, type MicAvailability } from "../use-speech-input";

export function MicButton({
  listening,
  availability,
  onStart,
  onStop,
  disabled,
}: {
  listening: boolean;
  availability: MicAvailability;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
}) {
  const unavailable = availability === "insecure" || availability === "unsupported";
  return (
    <button
      type="button"
      className={`btn h-12 ${listening ? "border-bad! bg-bad! text-white!" : ""}`}
      onClick={listening ? onStop : onStart}
      disabled={disabled || unavailable}
      aria-pressed={listening}
      aria-label={listening ? "Stop listening" : "Speak (German speech input)"}
      title={unavailable ? MIC_HELP[availability as "insecure" | "unsupported"] : listening ? "Listening… click to stop" : "Speak German"}
      data-testid="mic-button"
    >
      <span className="relative">
        <IconMic />
        {listening && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 animate-ping rounded-full bg-white" />}
      </span>
      {listening && <span className="text-sm">Listening…</span>}
    </button>
  );
}
