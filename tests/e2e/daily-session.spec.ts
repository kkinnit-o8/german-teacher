import { expect, test, type Page } from "@playwright/test";
import { answerQuiz, freshStart, learnAll, moveClock } from "./helpers";

freshStart();

async function chatToTarget(page: Page) {
  await page.goto("/session/chat");
  await page.getByTestId("start-chat").click();
  const teacher = page.getByTestId("teacher-message");
  await expect(teacher).toHaveCount(1);
  for (let i = 1; i <= 10; i++) {
    await page.getByTestId("chat-input").fill(i === 1 ? "die tisch ist gross" : `Ich esse gern Brot, Nummer ${i}.`);
    await page.getByTestId("chat-send").click();
    await expect(teacher).toHaveCount(i + 1);
  }
  await expect(page.getByTestId("chat-complete")).toBeVisible();
}

async function reviewAll(page: Page) {
  await page.goto("/session/review");
  for (let i = 0; i < 40; i++) {
    const next = page.getByTestId("next-step");
    const reveal = page.getByTestId("reveal");
    await expect(next.or(reveal)).toBeVisible();
    if (await next.isVisible()) return;
    await reveal.click();
    await page.getByTestId("rate-good").click();
  }
}

test("one full daily session, two days in a row", async ({ page }) => {
  // day 1: nothing to review yet
  await page.goto("/");
  await expect(page.getByTestId("step-review")).toHaveAttribute("data-status", "skipped");
  await learnAll(page);
  await answerQuiz(page);
  await chatToTarget(page);
  await page.getByTestId("next-step").click();
  await expect(page.getByTestId("summary")).toBeVisible();
  await expect(page.getByTestId("streak")).toHaveText("1 day streak");
  await expect(page.getByTestId("summary-quiz")).toHaveText(/^(\d+)\/\1$/); // all correct
  await expect(page.getByTestId("summary").getByText("Tisch is masculine")).toBeVisible();
  await page.goto("/");
  for (const s of ["review", "learn", "quiz", "chat", "summary"]) {
    await expect(page.getByTestId(`step-${s}`)).not.toHaveAttribute("data-status", "todo");
  }
  await expect(page.getByText("All done for today")).toBeVisible();

  // day 2: yesterday's words are due, and the streak grows to 2
  await moveClock(page, 1);
  await page.goto("/");
  await expect(page.getByTestId("step-review")).toContainText("10 words due");
  await reviewAll(page);
  await learnAll(page);
  await answerQuiz(page);
  await chatToTarget(page);
  await page.goto("/session/summary");
  await expect(page.getByTestId("streak")).toHaveText("2 day streak");
});
