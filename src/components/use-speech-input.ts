"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Recognition = any;

export type MicAvailability = "ok" | "insecure" | "unsupported" | "unknown";

export function micAvailability(): MicAvailability {
  if (typeof window === "undefined") return "unknown";
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  // a fake for the end-to-end tests
  if ((window as any).__fakeSpeechRecognition) return "ok";
  if (!window.isSecureContext) return "insecure";
  if (!SR) return "unsupported";
  return "ok";
}

export const MIC_HELP: Record<Exclude<MicAvailability, "ok" | "unknown">, string> = {
  insecure:
    "The microphone only works on a secure page. On this computer, open the app at http://localhost:3700. On a phone over Wi-Fi (http://192.168…), browsers block the microphone; type instead, or use the phone's own keyboard dictation.",
  unsupported:
    "This browser has no speech recognition. Use Microsoft Edge or Google Chrome (they send your speech to Microsoft's or Google's speech service, so it needs internet).",
};

/**
 * German speech recognition (Web Speech API, de-DE). Interim results stream
 * into `onText`; `onFinal` fires once with the final text when you stop talking.
 */
export function useSpeechInput({
  onText,
  onFinal,
}: {
  onText: (text: string) => void;
  onFinal?: (text: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const [availability, setAvailability] = useState<MicAvailability>("unknown");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const finalRef = useRef("");
  const cbs = useRef({ onText, onFinal });
  useEffect(() => {
    cbs.current = { onText, onFinal };
  });

  useEffect(() => {
    // browser capabilities are only known after mounting
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAvailability(micAvailability());
    return () => recRef.current?.abort?.();
  }, []);

  const start = useCallback(() => {
    if (micAvailability() !== "ok") return false;
    const w = window as any;
    const SR = w.__fakeSpeechRecognition || w.SpeechRecognition || w.webkitSpeechRecognition;
    recRef.current?.abort?.();
    const rec: Recognition = new SR();
    rec.lang = "de-DE";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    finalRef.current = "";
    rec.onresult = (e: any) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      finalRef.current = text.trim();
      cbs.current.onText(finalRef.current);
    };
    rec.onerror = (e: any) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed")
        setError("Microphone access was blocked. Allow the microphone for this page in the browser's address bar.");
      else if (e.error === "no-speech") setError("I didn't hear anything. Try again.");
      else if (e.error === "network") setError("Speech recognition needs an internet connection.");
      else if (e.error !== "aborted") setError(`Speech recognition error: ${e.error}`);
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      if (finalRef.current) cbs.current.onFinal?.(finalRef.current);
    };
    setError(null);
    setListening(true);
    recRef.current = rec;
    try {
      rec.start();
    } catch {
      setListening(false);
      return false;
    }
    return true;
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop?.();
  }, []);

  return { listening, availability, error, start, stop };
}
