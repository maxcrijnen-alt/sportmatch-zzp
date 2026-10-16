import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { authMailLink } from "./helpers/auth-mail";

test.skip(process.env.RUN_DEMO_E2E !== "true", "Isolated Supabase is required");

for (const role of ["organization", "instructor"] as const) {
  test(`${role}: registratie blijft beschermd tot bevestiging uit echte lokale mail`, async ({ page, request, baseURL }, testInfo) => {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } });
    const email = `signup-${randomUUID()}@example.test`;
    const password = `Signup-${randomUUID()}-aA1!`;
    try {
      await page.goto("/registreren");
      await page.getByRole("button", { name: role === "organization" ? "Ik zoek instructeurs" : "Ik ben instructeur" }).click();
      await page.getByLabel(role === "organization" ? "Naam contactpersoon" : "Volledige naam").fill(`CI ${role}`);
      await page.getByLabel("E-mailadres").fill(email);
      await page.getByLabel("Wachtwoord", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Gratis account aanmaken" }).click();
      await expect(page.getByRole("status")).toContainText("Controleer je e-mail");
      const profile = await admin.from("profiles").select("id,role,demo_session_id").eq("email", email).single();
      expect(profile.error).toBeNull();
      expect(profile.data!.role).toBe(role);
      expect(profile.data!.demo_session_id).toBeNull();
      const before = await admin.auth.admin.getUserById(profile.data!.id);
      expect(before.data.user!.email_confirmed_at).toBeFalsy();

      await page.goto("/onboarding");
      await expect(page).toHaveURL(/\/login$/);
      await page.getByLabel("E-mailadres").fill(email);
      await page.getByLabel("Wachtwoord", { exact: true }).fill(password);
      await page.getByRole("main").getByRole("button", { name: "Inloggen", exact: true }).click();
      await expect(page.getByText("Inloggen mislukt.", { exact: false })).toBeVisible();
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/login$/);

      const link = await authMailLink(request, email, baseURL!, "email");
      // The email must also work without the registration browser's PKCE cookie.
      await page.context().clearCookies();
      await page.goto(link.href);
      await expect(page).toHaveURL(/\/onboarding$/);
      await page.reload();
      await expect(page).toHaveURL(/\/onboarding$/);
      const confirmed = await admin.auth.admin.getUserById(profile.data!.id);
      expect(confirmed.data.user!.email_confirmed_at).toBeTruthy();
      await page.screenshot({ path: testInfo.outputPath("email-confirmed.png"), fullPage: true });

      await page.context().clearCookies();
      await page.goto(link.href);
      await expect(page).toHaveURL(/\/login\?fout=link-verlopen$/);
      await expect(page.getByText("Deze link is ongeldig, verlopen of al gebruikt.", { exact: false })).toBeVisible();
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/login$/);
    } finally {
      await page.context().close();
      const profiles = await admin.from("profiles").select("id").eq("email", email);
      expect(profiles.error).toBeNull();
      for (const user of profiles.data ?? []) expect((await admin.auth.admin.deleteUser(user.id)).error).toBeNull();
    }
  });
}

test("bestaand account krijgt dezelfde registratiebevestiging en behoudt wachtwoord en rol", async ({ page }) => {
  const options = { auth: { autoRefreshToken: false, persistSession: false } };
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, options);
  const email = `existing-${randomUUID()}@example.test`;
  const password = `Existing-${randomUUID()}-aA1!`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true,
    user_metadata: { role: "instructor", full_name: "Existing CI" } });
  expect(created.error).toBeNull();
  const id = created.data.user!.id;
  try {
    await page.goto("/registreren?rol=organisatie");
    await page.getByLabel("Naam contactpersoon").fill("Duplicate name");
    await page.getByLabel("E-mailadres").fill(email);
    await page.getByLabel("Wachtwoord", { exact: true }).fill(`Different-${randomUUID()}-aA1!`);
    await page.getByRole("button", { name: "Gratis account aanmaken" }).click();
    await expect(page.getByRole("status")).toContainText("Controleer je e-mail");
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, options);
    const login = await client.auth.signInWithPassword({ email, password });
    expect(login.error).toBeNull();
    expect(login.data.user!.id).toBe(id);
    const profile = await admin.from("profiles").select("role").eq("id", id).single();
    expect(profile.data!.role).toBe("instructor");
    await client.auth.signOut();
  } finally {
    await page.context().close();
    expect((await admin.auth.admin.deleteUser(id)).error).toBeNull();
  }
});
