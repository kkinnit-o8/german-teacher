import { expect, test } from "@playwright/test";
import { freshStart } from "./helpers";

freshStart();

async function say(page: import("@playwright/test").Page, text: string) {
  const before = await page.getByTestId("dialogue").textContent();
  await page.getByTestId("chat-input").fill(text);
  await page.getByTestId("chat-send").click();
  await expect(page.getByTestId("chat-input")).toBeEnabled();
  return before;
}

test("City Adventures: a mission to three stars", async ({ page }) => {
  await page.goto("/play");
  await page.getByTestId("mission-cafe-coffee").click();
  await expect(page.getByTestId("briefing")).toContainText("Order a coffee");
  await page.getByTestId("start-mission").click();

  await expect(page.getByTestId("play-screen")).toBeVisible();
  await expect(page.getByTestId("dialogue")).toContainText("Lena");
  await expect(page.getByTestId("hearts")).toHaveAttribute("data-hearts", "3");
  // characters stand in the scene, behind the counter
  const screen = page.getByTestId("play-screen");
  await expect(screen.getByTestId("actor-lena")).toBeVisible();
  await expect(screen.getByTestId("actor-jonas")).toBeVisible();

  // one hint is free for the third star
  await page.getByTestId("game-hint").click();
  await expect(page.getByTestId("game-hint-text")).toContainText("Kaffee");

  await say(page, "Hallo! Ich möchte einen Kaffee, bitte.");
  await expect(page.locator("[data-testid=checklist] [data-done=true]")).toHaveCount(2);
  await say(page, "Und eine Apfelschorle für Jonas. Was kostet das?");
  await say(page, "Hier, bitte. Danke schön!");

  await expect(page.getByTestId("results")).toBeVisible();
  await expect(page.getByTestId("results")).toContainText("Mission complete!");
  await expect(page.getByTestId("stars")).toHaveAttribute("data-stars", "3");

  await page.goto("/play");
  await expect(page.getByTestId("mission-cafe-coffee").locator("[aria-label='3 of 3 stars']")).toBeVisible();
});

test("City Adventures: du to someone who expects Sie, English and rudeness cost hearts", async ({ page }) => {
  await page.goto("/play/bahnhof-ticket");
  await page.getByTestId("start-mission").click();
  await expect(page.getByTestId("dialogue")).toContainText("Herr Schulze");

  // first du: only a warning
  await say(page, "Hallo, hast du eine Fahrkarte nach Hamburg?");
  await expect(page.getByTestId("event-formality-warning")).toBeVisible();
  await expect(page.getByTestId("hearts")).toHaveAttribute("data-hearts", "3");
  await expect(page.getByTestId("play-screen").getByTestId("actor-schulze")).toHaveAttribute("data-expression", "annoyed");

  // second du: a heart
  await say(page, "Kannst du mir bitte helfen?");
  await expect(page.getByTestId("event-formality")).toBeVisible();
  await expect(page.getByTestId("hearts")).toHaveAttribute("data-hearts", "2");

  // clear English: a heart (decided by the app, not the AI)
  await say(page, "I want a ticket to Hamburg please");
  await expect(page.getByTestId("event-english")).toBeVisible();
  await expect(page.getByTestId("hearts")).toHaveAttribute("data-hearts", "1");

  // rudeness: the last heart, the character gives up
  await say(page, "Sie Idiot!");
  await expect(page.getByTestId("results")).toContainText("Out of patience");
  await expect(page.getByTestId("stars")).toHaveAttribute("data-stars", "0");

  // try again starts fresh with three hearts
  await page.getByTestId("play-again").click();
  await expect(page.getByTestId("hearts")).toHaveAttribute("data-hearts", "3");
});

test("Meet the cast shows every character with six expressions", async ({ page }) => {
  await page.goto("/play/cast");
  await expect(page.getByTestId("cast-member")).toHaveCount(7);
  await expect(page.getByTestId("cast-member").first().locator("svg[role=img]")).toHaveCount(6);
});
