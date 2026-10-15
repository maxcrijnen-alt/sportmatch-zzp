import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

test.skip(process.env.RUN_DEMO_E2E !== "true", "Local Supabase E2E is not enabled");

test("inloggen controleert wachtwoord en uitloggen beschermt de sessie", async ({ page }) => {
  // playwright.config.ts rejects remote Supabase URLs before this code runs.
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const email = `ci-${randomUUID()}@example.test`;
  const password = `CI-${randomUUID()}-aA1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { role: "instructor", full_name: "CI Instructeur" },
  });
  expect(error).toBeNull();
  const userId = data.user!.id;
  try {
    const profile = await admin.from("profiles").update({ onboarding_completed: true }).eq("id", userId);
    expect(profile.error).toBeNull();
    const instructor = await admin.from("instructor_profiles").insert({ user_id: userId });
    expect(instructor.error).toBeNull();
    await page.goto("/login");
    await page.getByLabel("E-mailadres").fill(email);
    await page.getByLabel("Wachtwoord", { exact: true }).fill("incorrect-password");
    await page.getByRole("main").getByRole("button", { name: "Inloggen", exact: true }).click();
    await expect(page.getByText("Inloggen mislukt.", { exact: false })).toBeVisible();
    await page.getByLabel("Wachtwoord", { exact: true }).fill(password);
    await page.getByRole("main").getByRole("button", { name: "Inloggen", exact: true }).click();
    await page.waitForURL("**/dashboard");
    await expect(page.getByRole("link", { name: "Beschikbaarheid", exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: /uitloggen/i }).click();
    await page.waitForURL(/\/$/);
    await page.goto("/dashboard");
    await page.waitForURL("**/login");
  } finally {
    const cleanup = await admin.auth.admin.deleteUser(userId);
    expect(cleanup.error).toBeNull();
  }
});
