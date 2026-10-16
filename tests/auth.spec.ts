import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { setLegacyLocalPassword } from "./helpers/expire-recovery";

test.skip(process.env.RUN_DEMO_E2E !== "true", "Local Supabase E2E is not enabled");

test("Auth weigert een te kort wachtwoord ook buiten het formulier", async () => {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } });
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } });
  const email = `weak-${randomUUID()}@example.test`;
  try {
    const signup = await client.auth.signUp({ email, password: "aA1!xyz" });
    expect(signup.error?.code).toBe("weak_password");
    expect(signup.data.user).toBeNull();
    const profiles = await admin.from("profiles").select("id").eq("email", email);
    expect(profiles.error).toBeNull();
    expect(profiles.data).toHaveLength(0);
  } finally {
    const profiles = await admin.from("profiles").select("id").eq("email", email);
    for (const profile of profiles.data ?? []) {
      expect((await admin.auth.admin.deleteUser(profile.id)).error).toBeNull();
    }
  }
});

test("bestaand wachtwoord van zes tekens blijft geldig en uitloggen beschermt de sessie", async ({ page }) => {
  // playwright.config.ts rejects remote Supabase URLs before this code runs.
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const email = `ci-${randomUUID()}@example.test`;
  const password = "old123";
  const { data, error } = await admin.auth.admin.createUser({
    email, password: `CI-${randomUUID()}-aA1!`, email_confirm: true,
    user_metadata: { role: "instructor", full_name: "CI Instructeur" },
  });
  expect(error).toBeNull();
  const userId = data.user!.id;
  try {
    setLegacyLocalPassword(userId);
    const profile = await admin.from("profiles").update({ onboarding_completed: true }).eq("id", userId);
    expect(profile.error).toBeNull();
    const instructor = await admin.from("instructor_profiles").insert({ user_id: userId });
    expect(instructor.error).toBeNull();
    await page.goto("/login");
    await page.getByLabel("E-mailadres").fill(email);
    await page.getByLabel("Wachtwoord", { exact: true }).fill("incorrect-password");
    await page.getByRole("main").getByRole("button", { name: "Inloggen", exact: true }).click();
    await expect(page.getByText("Inloggen mislukt.", { exact: false })).toBeVisible();
    await page.getByLabel("E-mailadres").fill(email);
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
