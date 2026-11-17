"use client";

import { useCallback } from "react";
import { useAppState } from "./app-state";
import { speak as rawSpeak, stopSpeaking, type SpeakOptions } from "@/lib/client/speech";

/**
 * speak() bound to the device's voice settings; does nothing in silent mode.
 * opts.rate is a multiplier on the user's speed setting (characters speak faster or slower).
 */
export function useSpeech() {
  const { device } = useAppState();
  const speak = useCallback(
    (text: string, opts: SpeakOptions = {}) => {
      if (device.silent) {
        opts.onEnd?.();
        return Promise.resolve();
      }
      return rawSpeak(text, {
        ...opts,
        rate: device.ttsRate * (opts.rate ?? 1),
        voiceURI: opts.voiceURI ?? (device.ttsVoice || undefined),
      });
    },
    [device.silent, device.ttsRate, device.ttsVoice],
  );
  return { speak, stop: stopSpeaking, silent: device.silent };
}
