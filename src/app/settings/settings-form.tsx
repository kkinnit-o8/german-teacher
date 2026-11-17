"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAppState, type Theme } from "@/components/app-state";
import { MODEL_SUGGESTIONS, type GlossMode, type Settings } from "@/lib/settings";
import { germanVoices, speak, speechAvailable, voicesReady } from "@/lib/client/speech";

function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="card space-y-4 p-5">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {note && <p className="text-sm text-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({ label, hint, children, htmlFor }: { label: string; hint?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <label htmlFor={htmlFor} className="min-w-48 flex-1">
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </label>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, label, testId }: { checked: boolean; onChange: (v: boolean) => void; label: string; testId?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-14 rounded-full border border-border transition-colors ${checked ? "bg-accent" : "bg-surface-2"}`}
      data-testid={testId}
    >
      <span
        className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? "left-7" : "left-1"}`}
      />
    </button>
  );
}

function NumberSetting({ value, min, max, onSave, id }: { value: number; min: number; max: number; onSave: (n: number) => void; id: string }) {
  const [v, setV] = useState(String(value));
  return (
    <input
      id={id}
      className="input !w-24 text-center"
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const n = Math.min(max, Math.max(min, Math.round(Number(v) || min)));
        setV(String(n));
        if (n !== value) onSave(n);
      }}
    />
  );
}

function ModelSetting({ value, onSave }: { value: string; onSave: (m: string) => void }) {
  const [v, setV] = useState(value);
  const [check, setCheck] = useState<null | { text: string; ok: boolean }>(null);
  const run = async (id: string) => {
    setCheck({ text: "Checking…", ok: true });
    try {
      const r = await (await fetch(`/api/models/check?id=${encodeURIComponent(id)}`)).json();
      if (r.offline) setCheck({ text: "Couldn't reach OpenRouter to check the model (offline?).", ok: false });
      else if (!r.found)
        setCheck({
          text: `OpenRouter has no model “${id}”.${r.suggestions?.length ? ` Did you mean: ${r.suggestions.join(", ")}?` : ""}`,
          ok: false,
        });
      else
        setCheck({
          ok: true,
          text: `${r.name}: $${r.inputPerMillion} in / $${r.outputPerMillion} out per million tokens${
            r.structuredOutputs ? ", structured outputs" : ", no structured outputs (JSON mode fallback)"
          }${r.reasoningEffort ? `, reasoning effort: ${r.reasoningEffort}` : ""}.`,
        });
    } catch {
      setCheck({ text: "Check failed.", ok: false });
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <input
          className="input flex-1"
          list="model-suggestions"
          value={v}
          onChange={(e) => setV(e.target.value)}
          aria-label="OpenRouter model id"
          spellCheck={false}
          data-testid="model-input"
        />
        <button
          className="btn"
          onClick={() => {
            onSave(v.trim());
            run(v.trim());
          }}
          disabled={!v.trim()}
        >
          Save and check
        </button>
      </div>
      <datalist id="model-suggestions">
        {MODEL_SUGGESTIONS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.note}
          </option>
        ))}
      </datalist>
      <ul className="flex flex-wrap gap-2 text-sm">
        {MODEL_SUGGESTIONS.map((m) => (
          <li key={m.id}>
            <button
              className="chip hover:text-text"
              onClick={() => {
                setV(m.id);
                onSave(m.id);
                run(m.id);
              }}
              title={m.note}
            >
              {m.id}
            </button>
          </li>
        ))}
      </ul>
      {check && <p className={`text-sm ${check.ok ? "text-muted" : "text-bad"}`}>{check.text}</p>}
    </div>
  );
}

function VoiceSettings() {
  const { device, setDevice } = useAppState();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    voicesReady().then((v) => {
      setVoices(v);
      setLoaded(true);
    });
    if (speechAvailable()) {
      const on = () => setVoices(germanVoices());
      window.speechSynthesis.addEventListener("voiceschanged", on);
      return () => window.speechSynthesis.removeEventListener("voiceschanged", on);
    }
  }, []);
  if (!speechAvailable()) return <p className="text-sm text-bad">This browser can’t speak text aloud.</p>;
  return (
    <div className="space-y-4">
      {loaded && voices.length === 0 && (
        <div className="rounded-xl bg-warn/10 p-4 text-sm" data-testid="no-voice-help">
          <p className="font-semibold">No German voice is installed.</p>
          <p className="mt-1">On Windows 10/11:</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            <li>Open Settings → Time &amp; language → Speech.</li>
            <li>Under “Manage voices”, click “Add voices”.</li>
            <li>Choose “German (Germany)” and install it.</li>
            <li>Restart the browser and reload this page.</li>
          </ol>
          <p className="mt-2">
            Tip: Microsoft Edge has high-quality online German voices (“Microsoft Katja Online (Natural)”, “Conrad”)
            without installing anything.
          </p>
        </div>
      )}
      <Row label="Voice" hint="German voices on this device" htmlFor="voice">
        <select
          id="voice"
          className="input !w-auto max-w-72"
          value={device.ttsVoice}
          onChange={(e) => setDevice({ ttsVoice: e.target.value })}
        >
          <option value="">Automatic</option>
          {voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>
      </Row>
      <Row label="Speed" hint={`${Math.round(device.ttsRate * 100)}%`} htmlFor="rate">
        <input
          id="rate"
          type="range"
          min={0.5}
          max={1.3}
          step={0.05}
          value={device.ttsRate}
          onChange={(e) => setDevice({ ttsRate: Number(e.target.value) })}
          className="w-48 accent-[var(--accent)]"
        />
      </Row>
      <button
        className="btn btn-sm"
        onClick={() => speak("Hallo! Ich bin deine Deutschlehrerin. Wie geht es dir?", { rate: device.ttsRate, voiceURI: device.ttsVoice || undefined })}
        disabled={device.silent}
      >
        Test the voice
      </button>
    </div>
  );
}

function BackupSettings() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<null | { ok: boolean; text: string }>(null);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <a className="btn" href="/api/backup" download data-testid="export-backup">
          Export my progress
        </a>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          Import a backup…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            if (!confirm("Importing replaces ALL your current progress with the backup. Continue?")) return;
            try {
              const r = await fetch("/api/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: await file.text() });
              const j = await r.json();
              if (j.ok) {
                setMsg({ ok: true, text: `Backup imported (${j.rows} records). Reloading…` });
                // a full reload, so the whole app picks up the imported progress
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                setTimeout(() => window.location.assign("/"), 800);
              } else setMsg({ ok: false, text: j.error });
            } catch {
              setMsg({ ok: false, text: "That file could not be read." });
            }
          }}
        />
      </div>
      {msg && <p className={msg.ok ? "text-good" : "text-bad"}>{msg.text}</p>}
    </div>
  );
}

export function SettingsForm() {
  const { settings, updateSettings, device, setDevice } = useAppState();
  const save = (patch: Partial<Settings>) => void updateSettings(patch);
  return (
    <div className="space-y-4">
      <Section title="Daily session">
        <Row label="New words per day" htmlFor="newPerDay">
          <NumberSetting id="newPerDay" value={settings.newPerDay} min={0} max={50} onSave={(n) => save({ newPerDay: n })} />
        </Row>
        <Row label="Exchanges with the teacher per day" hint="one message from you plus one reply" htmlFor="exchanges">
          <NumberSetting id="exchanges" value={settings.exchangesPerDay} min={1} max={50} onSave={(n) => save({ exchangesPerDay: n })} />
        </Row>
        <Row label="Maximum reviews per day" hint="so a missed week doesn’t become a wall of reviews" htmlFor="maxReviews">
          <NumberSetting id="maxReviews" value={settings.maxReviews} min={10} max={1000} onSave={(n) => save({ maxReviews: n })} />
        </Row>
      </Section>

      <Section title="Teacher" note="Any model on openrouter.ai. Cheap models are fine for a beginner's chat.">
        <ModelSetting value={settings.model} onSave={(m) => save({ model: m })} />
        <Row label="Explanation language" hint="for meanings, corrections and translations" htmlFor="explang">
          <input
            id="explang"
            className="input !w-40"
            defaultValue={settings.explanationLanguage}
            onBlur={(e) => e.target.value.trim() !== settings.explanationLanguage && save({ explanationLanguage: e.target.value })}
          />
        </Row>
      </Section>

      <Section title="Reading">
        <Row label="Glosses" hint="the small English meaning above German words">
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Glosses">
            {(
              [
                ["unlearned", "New words"],
                ["all", "All words"],
                ["none", "Off (challenge)"],
              ] as [GlossMode, string][]
            ).map(([m, label]) => (
              <button
                key={m}
                role="radio"
                aria-checked={settings.glossMode === m}
                className={`btn btn-sm ${settings.glossMode === m ? "btn-primary" : ""}`}
                onClick={() => save({ glossMode: m })}
              >
                {label}
              </button>
            ))}
          </div>
        </Row>
        <Row label="Gender colours" hint="der blue, die red, das green, plural amber">
          <Toggle checked={settings.genderColors} onChange={(v) => save({ genderColors: v })} label="Gender colours" />
        </Row>
        <p className="text-lg">
          <span className="g-m font-semibold">der Tisch</span> · <span className="g-f font-semibold">die Lampe</span> ·{" "}
          <span className="g-n font-semibold">das Buch</span> · <span className="g-pl font-semibold">die Bücher</span>
        </p>
      </Section>

      <Section title="Sound" note="Voice, speed and silent mode are saved on this device only.">
        <Row label="Read the teacher’s replies aloud automatically">
          <Toggle checked={settings.autoSpeak} onChange={(v) => save({ autoSpeak: v })} label="Auto-speak" testId="autospeak-toggle" />
        </Row>
        <Row label="Silent mode" hint="no sound anywhere; listening questions become reading questions">
          <Toggle checked={device.silent} onChange={(v) => setDevice({ silent: v })} label="Silent mode" />
        </Row>
        <VoiceSettings />
      </Section>

      <Section title="Appearance" note="Saved on this device.">
        <Row label="Theme">
          <div className="flex gap-1" role="radiogroup" aria-label="Theme">
            {(["system", "light", "dark"] as Theme[]).map((t) => (
              <button
                key={t}
                role="radio"
                aria-checked={device.theme === t}
                className={`btn btn-sm ${device.theme === t ? "btn-primary" : ""}`}
                onClick={() => setDevice({ theme: t })}
              >
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </Row>
      </Section>

      <Section title="Backup" note="Everything you have learned, your reviews, chats, game results and settings.">
        <BackupSettings />
      </Section>

      <p className="text-center text-sm text-muted">
        <Link href="/about" className="underline">
          About, data sources and licences
        </Link>
      </p>
    </div>
  );
}
