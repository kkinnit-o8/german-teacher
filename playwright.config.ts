import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const PORT = 3701;
const DATA = path.join(__dirname, "tests", "e2e", ".data");

/**
 * End-to-end tests run the production build against a fresh data folder, with
 * the test clock enabled and OpenRouter replaced by a local mock server.
 * Run with: npm run e2e
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
    ...devices["Desktop Chrome"],
  },
  webServer: [
    {
      command: "node tests/e2e/mock-openrouter.mjs",
      port: 3799,
      reuseExistingServer: false,
    },
    {
      command: `node tests/e2e/reset-data.mjs && npx next build && npx next start -p ${PORT}`,
      port: PORT,
      timeout: 300_000,
      reuseExistingServer: false,
      env: {
        GT_TEST_MODE: "1",
        GT_DATA_DIR: DATA,
        OPENROUTER_API_KEY: "test-key",
        OPENROUTER_BASE_URL: "http://localhost:3799/api/v1",
      },
    },
  ],
});
