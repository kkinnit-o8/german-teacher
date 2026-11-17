import { defineConfig } from "vitest/config";
import path from "node:path";
import os from "node:os";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "tests/helpers/empty.ts"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    globalSetup: ["tests/helpers/global-setup.ts"],
    env: { GT_DATA_DIR: path.join(os.tmpdir(), "german-teacher-test-data") },
    testTimeout: 30000,
    hookTimeout: 120000,
  },
});
