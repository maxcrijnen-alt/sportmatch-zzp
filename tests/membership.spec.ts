import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { devices, expect, test, type Page } from "@playwright/test";

test.skip(process.env.RUN_DEMO_E2E !== "true", "Isolated local Supabase is required");

test("teamuitnodiging behoudt de rol en mislukte acceptatie voltooit onboarding niet", async ({ page: owner, browser }, testInfo) => {
  test.setTimeout(120_000);
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } });
  const nonce = randomUUID();
  const email = `member-${nonce}@example.test`;
  const ownerEmail = `member-owner-${nonce}@example.test`;
  const password = `Membership-${nonce}-aA1!`;
  const userIds: string[] = [];
  let organizationId: string | null = null;
  const staffContext = await browser.newContext({
    ...(testInfo.project.name === "mobile" ? devices["Pixel 7"] : devices["Desktop Chrome"]),
    baseURL: testInfo.project.use.baseURL,
  });
  const staff = await staffContext.newPage();
  async function login(page: Page, address: string) {
    await page.goto("/login");
    await page.getByLabel("E-mailadres", { exact: true }).fill(address);
    await page.getByLabel("Wachtwoord", { exact: true }).fill(password);
    await page.getByRole("main").getByRole("button", { name: "Inloggen", exact: true }).click();
  }
  try {
    for (const address of [ownerEmail, email]) {
      const created = await admin.auth.admin.createUser({ email: address, password, email_confirm: true,
        user_metadata: { role: "organization", full_name: address === email ? "CI Teamlid" : "CI Eigenaar" } });
      expect(created.error).toBeNull();
      userIds.push(created.data.user!.id);
    }
    expect((await admin.from("profiles").update({ onboarding_completed: true }).eq("id", userIds[0])).error).toBeNull();
    const organization = await admin.from("organizations").insert({ name: `CI Team ${nonce}`, org_type: "gym", created_by: userIds[0] }).select("id").single();
    expect(organization.error).toBeNull();
    organizationId = organization.data!.id;
    expect((await admin.from("organization_members").insert({ organization_id: organizationId, user_id: userIds[0], member_role: "owner" })).error).toBeNull();
    await login(owner, ownerEmail);
    await owner.waitForURL("**/dashboard");
    await owner.goto("/organisatie/medewerkers");
    await owner.getByLabel("E-mailadres medewerker").fill(email);
    await owner.getByLabel("Rol", { exact: true }).selectOption("planner");
    await owner.getByRole("button", { name: "Medewerker uitnodigen", exact: true }).click();
    await expect(owner.getByText("Uitnodiging klaargezet.", { exact: false })).toBeVisible();
    await login(staff, email);
    await staff.waitForURL("**/onboarding");
    await expect(staff.getByRole("button", { name: "Uitnodiging accepteren", exact: true })).toBeVisible();
    // Revoke after rendering, exercising the real server action's failure path.
    expect((await admin.from("organization_members").delete().eq("organization_id", organizationId).eq("invited_email", email)).error).toBeNull();
    await staff.getByRole("button", { name: "Uitnodiging accepteren", exact: true }).click();
    await expect(staff.getByRole("alert")).toContainText("Uitnodiging accepteren is niet gelukt.");
    expect((await admin.from("profiles").select("onboarding_completed").eq("id", userIds[1]).single()).data!.onboarding_completed).toBe(false);
    expect(new URL(staff.url()).pathname).toBe("/onboarding");

    await owner.reload();
    await owner.getByLabel("E-mailadres medewerker").fill(email);
    await owner.getByRole("button", { name: "Medewerker uitnodigen", exact: true }).click();
    await expect(owner.getByText("Uitnodiging klaargezet.", { exact: false })).toBeVisible();
    await staff.reload();
    await staff.getByRole("button", { name: "Uitnodiging accepteren", exact: true }).click();
    await staff.waitForURL("**/dashboard");
    await staff.goto("/organisatie/medewerkers");
    await expect(staff.getByText("CI Teamlid", { exact: true })).toBeVisible();
    await expect(staff.getByRole("heading", { name: "Medewerker uitnodigen", exact: true })).toHaveCount(0);
    const member = await admin.from("organization_members").select("member_role,state").eq("organization_id", organizationId).eq("user_id", userIds[1]).single();
    expect(member.error).toBeNull();
    expect(member.data).toEqual({ member_role: "planner", state: "active" });
    await staff.screenshot({ path: testInfo.outputPath("team-accepted.png"), fullPage: true });
  } finally {
    await staffContext.close();
    await owner.goto("/");
    if (organizationId) expect((await admin.from("organizations").delete().eq("id", organizationId)).error).toBeNull();
    for (const id of userIds) expect((await admin.auth.admin.deleteUser(id)).error).toBeNull();
  }
});
