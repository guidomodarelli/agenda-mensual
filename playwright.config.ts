import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  // Closes WebKit processes orphaned by Playwright runs that died abruptly on
  // Windows (see @astra-kit/cleaner); a no-op on other platforms. It runs
  // before the suite (the main case: leftovers from earlier runs) and after it.
  globalSetup: "@astra-kit/cleaner/playwright/global-setup",
  globalTeardown: "@astra-kit/cleaner/playwright/global-teardown",
  fullyParallel: true,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : [["line"]],
  use: {
    baseURL: "http://localhost:3112",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "chromium-mobile", use: { ...devices["Pixel 7"] } },
    { name: "webkit-mobile", use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command: "pnpm run build && pnpm run start --port 3112",
    url: "http://localhost:3112",
    reuseExistingServer: !isCI,
    timeout: 180000,
  },
});
