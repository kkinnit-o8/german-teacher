import { expect, test } from "@playwright/test";
import { freshStart } from "./helpers";

freshStart();

/** Fake Web Speech: synthesis finishes at once, recognition "hears" a fixed sentence. */
async function fakeSpeech(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__spoken = [] as string[];
    const synth = {
      speaking: false,
      getVoices: () => [{ name: "Fake Deutsch", lang: "de-DE", voiceURI: "fake-de" }],
      addEventListener: () => {},
      removeEventListener: () => {},
      cancel: () => {},
      speak: (u: { text: string; onstart?: () => void; onend?: () => void }) => {
        (w.__spoken as string[]).push(u.text);
        setTimeout(() => {
          u.onstart?.();
          u.onend?.();
        }, 20);
      },
    };
    Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
    class FakeUtterance {
      text: string;
      constructor(t: string) {
        this.text = t;
      }
    }
    w.SpeechSynthesisUtterance = FakeUtterance;
    let heard = 0;
    class FakeRecognition {
      lang = "";
      interimResults = false;
      continuous = false;
      maxAlternatives = 1;
      onresult?: (e: unknown) => void;
      onend?: () => void;
      onerror?: (e: unknown) => void;
      start() {
        heard++;
        const text = `Ich esse gern Brot, Nummer ${heard}`;
        setTimeout(() => {
          this.onresult?.({ results: [[{ transcript: text }]] });
          this.onend?.();
        }, 60);
      }
      stop() {}
      abort() {}
    }
    w.__fakeSpeechRecognition = FakeRecognition;
  });
}

test("speaking mode: the reply is read aloud, the mic opens and the answer is sent", async ({ page }) => {
  await fakeSpeech(page);
  await page.goto("/session/chat");
  await page.getByTestId("start-chat").click();
  await expect(page.getByTestId("teacher-message")).toHaveCount(1);
  await page.getByTestId("speaking-mode").click();
  // turning speaking mode on doesn't replay the old message; use the mic once to get going
  await page.getByTestId("mic-button").click();
  // the fake recognition hears a sentence, it is sent, the reply is spoken, the mic opens again...
  await expect(page.getByTestId("user-message")).toHaveCount(3, { timeout: 15000 });
  await page.getByTestId("speaking-mode").click();
  const spoken = await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
  expect(spoken.length).toBeGreaterThanOrEqual(3);
  expect(spoken[0]).toContain("Hallo"); // the opening greeting
  expect(spoken[1]).toContain("Schön"); // the reply to the first spoken answer
});

test("the mic writes into the message box; silent mode turns all sound off", async ({ page }) => {
  await fakeSpeech(page);
  await page.goto("/session/chat");
  await page.getByTestId("start-chat").click();
  await expect(page.getByTestId("teacher-message")).toHaveCount(1);
  await page.getByTestId("mic-button").click();
  await expect(page.getByTestId("chat-input")).toHaveValue(/Ich esse gern Brot/);
  // not sent automatically outside speaking mode
  await expect(page.getByTestId("user-message")).toHaveCount(0);

  await page.getByTestId("silent-toggle").click();
  await expect(page.getByTestId("speaking-mode")).toBeDisabled();
  await page.getByTestId("chat-send").click();
  await expect(page.getByTestId("teacher-message")).toHaveCount(2);
  await page.waitForTimeout(300);
  const spoken = await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
  // auto-speak read the first reply before silent mode was on, but nothing after
  expect(spoken.length).toBe(1);
  await expect(page.getByRole("button", { name: "Play audio" })).toHaveCount(0);
});
