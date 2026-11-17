import { expect, test, type Locator, type Page } from "@playwright/test";

/** Every test starts with empty progress and the real clock. */
export function freshStart() {
  test.beforeEach(async ({ request }) => {
    const r = await request.post("/api/test/reset");
    expect(r.ok()).toBeTruthy();
  });
}

/** The visible German text of an element, without the ruby glosses. */
export async function germanText(locator: Locator): Promise<string> {
  return locator.evaluate((el) => {
    const c = el.cloneNode(true) as HTMLElement;
    c.querySelectorAll("rt, button").forEach((x) => x.remove());
    return (c.textContent ?? "").replace(/\s+/g, " ").trim();
  });
}

export async function moveClock(page: Page, days: number) {
  const r = await page.request.post("/api/test/clock", { data: { days } });
  expect(r.ok()).toBeTruthy();
}

/** Learn every new word of today's Learn step by typing it. */
export async function learnAll(page: Page) {
  await page.goto("/session/learn");
  for (let i = 0; i < 60; i++) {
    const next = page.getByTestId("next-step");
    const input = page.getByTestId("learn-input");
    await expect(next.or(input)).toBeVisible();
    if (await next.isVisible()) return;
    const target = (await input.getAttribute("placeholder"))!;
    await input.fill(target);
    await page.getByTestId("learn-check").click();
    await expect(page.getByTestId("learn-feedback")).toHaveText("Correct!");
    await page.getByTestId("learn-next").click();
    await expect(page.getByTestId("learn-feedback")).toBeHidden();
  }
  throw new Error("learn step did not finish");
}

/** Answer the quiz correctly, using the answers shown after a deliberate mistake if needed. */
export async function answerQuiz(page: Page, { makeOneMistake = false } = {}) {
  await page.goto("/session/quiz");
  let mistakes = makeOneMistake ? 1 : 0;
  for (let i = 0; i < 80; i++) {
    const done = page.getByTestId("quiz-done");
    const card = page.getByTestId("quiz-card");
    await expect(done.or(card)).toBeVisible();
    if (await done.isVisible()) return;
    const kind = await card.getAttribute("data-kind");
    const answer = await page.evaluate(async () => {
      const r = await fetch("/api/day");
      const v = await r.json();
      const q = v.state.quiz.questions.find((x: { id: string }) => x.id === v.state.quiz.queue[0]);
      return q.kind === "en2de" ? (q.target.article ? `${q.target.article} ${q.target.lemma}` : q.target.lemma) : q.answer;
    });
    const wrong = mistakes > 0;
    if (kind === "en2de") {
      await page.getByTestId("quiz-input").fill(wrong ? "falsch" : answer);
      await page.getByTestId("quiz-input").press("Enter");
    } else {
      const options = page.getByTestId("quiz-option");
      const texts = await options.allTextContents();
      const pick = wrong ? texts.find((t) => t !== answer)! : answer;
      await options.filter({ hasText: new RegExp(`^${pick.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }).first().click();
    }
    if (wrong) mistakes--;
    await expect(page.getByTestId("quiz-feedback")).toBeVisible();
    await page.getByTestId("quiz-next").click();
    await expect(page.getByTestId("quiz-feedback")).toBeHidden();
  }
  throw new Error("quiz did not finish");
}
