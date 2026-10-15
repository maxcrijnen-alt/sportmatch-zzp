import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// In sommige (CI-)omgevingen staat een vooraf geïnstalleerde Chromium klaar;
// gebruik die dan in plaats van een download.
const preinstalledChromium = "/opt/pw-browsers/chromium";
const launchOptions = existsSync(preinstalledChromium)
  ? { executablePath: preinstalledChromium }
  : {};

const isCI = process.env.CI === "true";
const demoReady = process.env.RUN_DEMO_E2E === "true";
// NextURL canonicalizes loopback IPs to localhost. Use that same host for the
// browser so auth-confirm redirects retain their host-scoped session cookies.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const supabaseURL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
for (const value of [baseURL, supabaseURL].filter(Boolean)) {
  const url = new URL(value);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error("Playwright only permits local test services.");
  }
}
if (isCI && !demoReady) throw new Error("CI requires RUN_DEMO_E2E=true; demo tests may not be skipped.");
if (demoReady && (!supabaseURL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
  throw new Error("Demo E2E requires the isolated local Supabase stack and its test keys.");
}

export default defineConfig({
  testDir: "./tests",
  outputDir: "test-results/playwright",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  forbidOnly: isCI,
  globalTimeout: 15 * 60_000,
  reporter: isCI
    ? [["list"], ["html", { open: "never" }], ["json", { outputFile: "test-results/e2e-results.json" }]]
    : [["list"]],
  timeout: 60_000,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: /public\.spec\.ts/,
    },
  ],
  webServer: {
    command: `node node_modules/next/dist/bin/next start --hostname ${new URL(baseURL).hostname}`,
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 60_000,
    // Override .env.local so public-only runs cannot inherit production config.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: supabaseURL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      NEXT_PUBLIC_APP_URL: baseURL,
      BILLING_PROVIDER: "mock",
      EMAIL_PROVIDER: "log",
    },
  },
});
