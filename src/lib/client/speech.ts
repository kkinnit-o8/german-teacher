"use client";

/**
 * Text-to-speech with the browser's Web Speech API (de-DE voices).
 * Silent mode is enforced by the callers through useSpeech().
 */

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  voiceURI?: string;
  onStart?: () => void;
  onEnd?: () => void;
  /** fires on word boundaries (used for the game's mouth animation) */
  onBoundary?: () => void;
}

export function speechAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

export function germanVoices(): SpeechSynthesisVoice[] {
  if (!speechAvailable()) return [];
  return window.speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith("de"));
}

/** Resolves once voices are loaded (Chrome loads them asynchronously). */
export function voicesReady(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  if (!speechAvailable()) return Promise.resolve([]);
  const now = germanVoices();
  if (now.length || window.speechSynthesis.getVoices().length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => resolve(germanVoices());
    window.speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, timeoutMs);
  });
}

function pickVoice(voiceURI?: string): SpeechSynthesisVoice | undefined {
  const voices = germanVoices();
  if (voiceURI) {
    const v = voices.find((x) => x.voiceURI === voiceURI);
    if (v) return v;
  }
  return (
    voices.find((v) => v.lang === "de-DE" && /natural|online|neural/i.test(v.name)) ??
    voices.find((v) => v.lang === "de-DE") ??
    voices[0]
  );
}

export function stopSpeaking() {
  if (speechAvailable()) window.speechSynthesis.cancel();
}

export function isSpeaking(): boolean {
  return speechAvailable() && window.speechSynthesis.speaking;
}

/** Speak German text; resolves when finished (or immediately if speech is unavailable). */
export function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  if (!speechAvailable() || !text.trim()) {
    opts.onEnd?.();
    return Promise.resolve();
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "de-DE";
    const v = pickVoice(opts.voiceURI);
    if (v) u.voice = v;
    u.rate = opts.rate ?? 0.9;
    u.pitch = opts.pitch ?? 1;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      opts.onEnd?.();
      resolve();
    };
    u.onstart = () => opts.onStart?.();
    u.onend = finish;
    u.onerror = finish;
    u.onboundary = () => opts.onBoundary?.();
    synth.speak(u);
    // Chrome sometimes never fires onend for long texts; give up after a generous timeout
    setTimeout(finish, Math.max(4000, text.length * 160));
  });
}
