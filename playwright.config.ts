import { defineConfig, devices } from "@playwright/test";

const E2E_PORT = 3100;
const FAKE_API_PORT = 3101;
const FAKE_API_ORIGIN = `http://127.0.0.1:${FAKE_API_PORT}`;
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${E2E_PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : [
        {
          command: "node tests/e2e/support/fake-auth-api.mjs",
          url: `${FAKE_API_ORIGIN}/__health`,
          env: { FAKE_API_PORT: String(FAKE_API_PORT) },
          reuseExistingServer: false,
          timeout: 10_000,
        },
        {
          command: `pnpm start --port ${E2E_PORT}`,
          url: baseURL,
          env: { API_BASE_URL: FAKE_API_ORIGIN },
          reuseExistingServer: false,
          timeout: 120_000,
        },
      ],
});
