import { appendFileSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { setTimeout } from "node:timers/promises";

const status = JSON.parse(readFileSync(process.argv[2], "utf8"));
function requireLoopback(value, protocol) {
  const url = new URL(value);
  if (url.protocol !== protocol || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error("Regression tests require loopback test services.");
  }
  return value;
}
requireLoopback(status.API_URL, "http:");
requireLoopback(status.DB_URL, "postgresql:");
if (!status.ANON_KEY || !status.SERVICE_ROLE_KEY) throw new Error("Local Supabase test keys are missing.");
if (process.env.GITHUB_ACTIONS) {
  for (const key of [status.ANON_KEY, status.SERVICE_ROLE_KEY]) console.log(`::add-mask::${key}`);
}
const env = {
  ...process.env,
  CI: "true",
  RUN_DEMO_E2E: "true",
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  LOCAL_MAILPIT_URL: requireLoopback(status.MAILPIT_URL ?? status.INBUCKET_URL, "http:"),
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  PLAYWRIGHT_BASE_URL: "http://localhost:3000",
  BILLING_PROVIDER: "mock",
  EMAIL_PROVIDER: "log",
};

async function waitForApi() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(`${status.API_URL}/rest/v1/sports?select=id&limit=1`, {
        headers: { apikey: status.ANON_KEY },
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) return;
    } catch { /* Service is still starting. */ }
    await setTimeout(1000);
  }
  throw new Error("Local Supabase API/seed did not become ready.");
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit" });
    const terminate = () => child.kill("SIGTERM");
    process.once("SIGTERM", terminate);
    child.once("error", reject);
    child.once("exit", (code) => {
      process.removeListener("SIGTERM", terminate);
      resolve(code ?? 1);
    });
  });
}

await waitForApi();
console.log("Local Supabase API and seed are ready.");
const buildExit = await run("npm", ["run", "build"]);
if (buildExit !== 0) process.exit(buildExit);
rmSync("test-results/e2e-results.json", { force: true });
const testExit = await run(process.execPath, ["node_modules/@playwright/test/cli.js", "test"]);
const report = JSON.parse(readFileSync("test-results/e2e-results.json", "utf8"));
const { expected, unexpected, flaky, skipped } = report.stats;
function countDemoTests(suite) {
  return (suite.specs ?? []).reduce((count, spec) =>
    count + (spec.file.endsWith("flows.spec.ts") ? spec.tests.length : 0), 0)
    + (suite.suites ?? []).reduce((count, child) => count + countDemoTests(child), 0);
}
const demoTests = report.suites.reduce((count, suite) => count + countDemoTests(suite), 0);
const summary = `Playwright: ${expected} passed, ${unexpected} failed, ${skipped} skipped, ${flaky} flaky. Demo scenarios collected: ${demoTests}.\n`;
console.log(summary);
writeFileSync("test-results/summary.md", summary);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
if (testExit !== 0 || unexpected || skipped || flaky || !expected || !demoTests) {
  console.error("Full regression requires passing tests, demo coverage and zero skipped/flaky tests.");
  process.exit(1);
}
