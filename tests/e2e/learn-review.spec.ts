import { expect, test } from "@playwright/test";
import { answerQuiz, learnAll, moveClock } from "./helpers";

test("learn new words, take the quick check, review them the next day", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("step-review")).toHaveAttribute("data-status", "skipped");
  await expect(page.getByTestId("step-learn")).toContainText("10 new words");

  await learnAll(page);
  await page.goto("/");
  await expect(page.getByTestId("step-learn")).toHaveAttribute("data-status", "done");

  await answerQuiz(page, { makeOneMistake: true });
  await expect(page.getByTestId("quiz-done")).toContainText("Score:");
  await page.goto("/");
  await expect(page.getByTestId("step-quiz")).toHaveAttribute("data-status", "done");

  // next day: the words learned yesterday are due
  await moveClock(page, 1);
  await page.goto("/");
  await expect(page.getByTestId("step-review")).toContainText("10 words due");
  await page.getByTestId("step-review").click();
  for (let i = 0; i < 20; i++) {
    const next = page.getByTestId("next-step");
    const reveal = page.getByTestId("reveal");
    await expect(next.or(reveal)).toBeVisible();
    if (await next.isVisible()) break;
    await reveal.click();
    await page.getByTestId(i === 0 ? "rate-again" : "rate-good").click();
  }
  await expect(page.getByTestId("next-step")).toBeVisible();
  await page.goto("/");
  await expect(page.getByTestId("step-review")).toHaveAttribute("data-status", "done");
  await expect(page.getByTestId("step-learn")).toContainText("10 new words");
});
