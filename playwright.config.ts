import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config — drives the running app at http://localhost:5173.
 * Run locally with:  bun run dev   (in one terminal)
 *                    bunx playwright test
 *
 * On first run install browsers with: bunx playwright install --with-deps chromium
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173",
    trace: "on-first-retry",
  },
  webServer: process.env.PLAYWRIGHT_NO_SERVER
    ? undefined
    : {
        command: "bun run dev",
        url: "http://localhost:5173",
        reuseExistingServer: true,
        timeout: 60_000,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
