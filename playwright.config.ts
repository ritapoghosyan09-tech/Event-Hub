import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end suite. Runs against a production build:
 *   npm run build && npm run test:e2e
 * Optional env:
 *   E2E_BASE_URL         test a deployed site instead of starting one
 *   CHROME_PATH          use an installed Chrome instead of Playwright's download
 *   E2E_OFFLINE_IMAGES=1 serve a local placeholder for CDN photos (no network)
 * The server runs with E2E=1 and PAYMENT_PROVIDER=test: card payments go
 * through the built-in test checkout and emails land in .data/outbox.jsonl,
 * where the account tests read their links.
 */
const chrome = process.env.CHROME_PATH ? { launchOptions: { executablePath: process.env.CHROME_PATH } } : {};

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  timeout: 45_000,
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", trace: "retain-on-failure", ...chrome },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, ...chrome } },
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 834, height: 1112 }, hasTouch: true, ...chrome } },
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, ...chrome } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run start",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 60_000,
        env: { E2E: "1", PAYMENT_PROVIDER: "test", MAIL_OUTBOX_FILE: ".data/outbox.jsonl" },
      },
});
