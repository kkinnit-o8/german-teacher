import { expect, test } from "@playwright/test";
import { freshStart, germanText, learnAll } from "./helpers";

freshStart();

test("teacher chat: glosses, translate, hint, corrections, retries and the daily target", async ({ page }) => {
  // learn today's words first, so some words in the chat are plain German
  await learnAll(page);
  await page.goto("/session/chat");
  await page.getByTestId("start-chat").click();

  const teacher = page.getByTestId("teacher-message");
  await expect(teacher.first()).toBeVisible();
  expect(await germanText(teacher.first())).toContain("Hallo! Wie geht es dir heute?");
  // unlearned words are marked and glossed
  await expect(teacher.first().locator("[data-unlearned=true]").first()).toBeVisible();
  await expect(teacher.first().locator("rt").first()).toBeVisible();

  await teacher.first().getByTestId("translate-btn").click();
  await expect(teacher.first().getByTestId("translation")).toHaveText("Hello! How are you today?");
  await teacher.first().getByTestId("hint-btn").click();
  await expect(teacher.first().getByTestId("hint")).toBeVisible();
  expect(await germanText(teacher.first().getByTestId("hint"))).toContain("Mir geht es gut");

  // a mistake gets a correction attached to my message
  await page.getByTestId("chat-input").fill("die tisch ist gross");
  await page.getByTestId("chat-send").click();
  await expect(teacher).toHaveCount(2);
  await expect(page.getByTestId("correction").first()).toContainText("Tisch is masculine");
  await expect(page.getByTestId("exchange-count")).toContainText("1 / 10");

  // the model sends bad JSON once: the app retries and the conversation goes on
  await page.getByTestId("chat-input").fill("Ich esse gern Brot BADJSON");
  await page.getByTestId("chat-send").click();
  await expect(teacher).toHaveCount(3);
  await expect(teacher.nth(2)).not.toContainText("unexpected format");

  // still unreadable after a retry: shown as raw text instead of crashing
  await page.getByTestId("chat-input").fill("RAWTEXT bitte");
  await page.getByTestId("chat-send").click();
  await expect(teacher).toHaveCount(4);
  await expect(teacher.nth(3)).toContainText("unexpected format");

  // words from the chat can be queued for tomorrow
  const words = page.getByTestId("chat-words");
  await expect(words).toBeVisible();
  await words.getByTestId("queue-chat-word").first().click();
  await expect(words).toContainText("tomorrow");

  // finish the daily target
  for (let i = 4; i <= 10; i++) {
    await page.getByTestId("chat-input").fill(`Das ist Nachricht ${i}.`);
    await page.getByTestId("chat-send").click();
    await expect(teacher).toHaveCount(i + 1);
  }
  expect(await germanText(teacher.last())).toContain("Bis morgen!");
  await expect(page.getByTestId("chat-complete")).toBeVisible();
  await expect(page.getByTestId("chat-input")).toBeHidden();
  await page.getByTestId("keep-chatting").click();
  await page.getByTestId("chat-input").fill("Noch eine Frage!");
  await page.getByTestId("chat-send").click();
  await expect(teacher).toHaveCount(12);
  await expect(page.getByTestId("exchange-count")).toContainText("(+1)");

  await page.goto("/");
  await expect(page.getByTestId("step-chat")).toHaveAttribute("data-status", "done");

  // the chat can be reread later
  await page.goto("/chats");
  await page.getByTestId("chat-link").first().click();
  await expect(page.getByTestId("teacher-message").first()).toBeVisible();
  expect(await germanText(page.getByTestId("teacher-message").first())).toContain("Hallo!");
  await expect(page.getByTestId("chat-input")).toBeHidden();
});

test("a missing or wrong API key shows a clear error with a retry button", async ({ page }) => {
  // the mock only accepts "test-key"; ask the server to use a wrong one for this request
  await page.goto("/chats");
  await page.request.post("/api/test/key", { data: { key: "wrong-key" } });
  await page.getByRole("button", { name: "New free chat" }).click();
  await page.getByTestId("start-chat").click();
  await expect(page.getByText("did not accept your API key")).toBeVisible();
  await page.request.post("/api/test/key", { data: { key: "test-key" } });
});
