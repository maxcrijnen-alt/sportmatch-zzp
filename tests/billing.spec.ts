import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

test.skip(process.env.RUN_DEMO_E2E !== "true", "Local Supabase E2E is not enabled");

for (const role of ["sportschool", "instructeur"]) {
  test(`demo ${role} kan mock-activeren, opzeggen en opnieuw activeren`, async ({ page }) => {
    await page.goto("/demo");
    await page.getByRole("button", { name: `Start demo als ${role}` }).click();
    await page.waitForURL("**/dashboard", { timeout: 45_000 });
    try {
      await page.goto("/abonnement");
      await page.getByRole("button", { name: "Abonnement activeren" }).first().click();
      await expect(page.getByText("Abonnement actief.", { exact: true }).first()).toBeVisible();
      await page.getByRole("button", { name: "Opzeggen", exact: true }).first().click();
      await expect(page.getByText("Abonnement opgezegd. Bestaande afspraken blijven zichtbaar.", { exact: true }).first()).toBeVisible();
      await page.getByRole("button", { name: "Abonnement activeren" }).first().click();
      await expect(page.getByText("Abonnement actief.", { exact: true }).first()).toBeVisible();
    } finally {
      await page.getByRole("button", { name: /uitloggen/i }).click();
      await page.waitForURL(/\/$/);
    }
  });
}

test("reguliere instructeur behoudt trial en krijgt geen mock-betaalknop", async ({ page }) => {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } });
  const email = `billing-${randomUUID()}@example.test`;
  const password = `Billing-${randomUUID()}-aA1!`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true,
    user_metadata: { role: "instructor", full_name: "CI Billing Instructeur" } });
  expect(created.error).toBeNull();
  const id = created.data.user!.id;
  try {
    expect((await admin.from("profiles").update({ onboarding_completed: true }).eq("id", id)).error).toBeNull();
    expect((await admin.from("instructor_profiles").insert({ user_id: id })).error).toBeNull();
    await page.goto("/login");
    await page.getByLabel("E-mailadres").fill(email);
    await page.getByLabel("Wachtwoord", { exact: true }).fill(password);
    await page.getByRole("main").getByRole("button", { name: "Inloggen", exact: true }).click();
    await page.waitForURL("**/dashboard");
    await page.goto("/abonnement");
    await expect(page.getByText("Betaalactivatie is nog niet beschikbaar.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Abonnement activeren" })).toHaveCount(0);
    await expect(page.getByText(/Proefperiode — nog 30 dagen gratis/)).toBeVisible();
    const subscription = await admin.from("subscriptions").select("status,trial_ends_at").eq("instructor_id", id).single();
    expect(subscription.data!.status).toBe("trial");
    expect(new Date(subscription.data!.trial_ends_at).getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);
  } finally {
    expect((await admin.auth.admin.deleteUser(id)).error).toBeNull();
  }
});
