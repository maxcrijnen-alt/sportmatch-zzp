import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test as base, type Page } from "@playwright/test";

type LocalUser = {
  admin: SupabaseClient;
  id: string;
  email: string;
  password: string;
};

// The shared config rejects remote services. Every account exists only in the
// disposable Supabase stack and is deleted even if its test fails.
const test = base.extend<{ localUser: LocalUser; emailConfirmed: boolean }>({
  emailConfirmed: [true, { option: true }],
  localUser: async ({ baseURL, emailConfirmed }, provideUser) => {
    if (!baseURL) throw new Error("Local app URL is required.");
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const email = `ci-confirm-${randomUUID()}@example.test`;
    const password = `CI-${randomUUID()}-aA1!`;
    const created = await admin.auth.admin.createUser({
      email, password, email_confirm: emailConfirmed,
      user_metadata: { role: "instructor", full_name: "CI Auth Instructeur" },
    });
    expect(created.error).toBeNull();
    const id = created.data.user!.id;
    try {
      const profile = await admin.from("profiles").update({ onboarding_completed: true }).eq("id", id);
      expect(profile.error).toBeNull();
      const instructor = await admin.from("instructor_profiles").insert({ user_id: id });
      expect(instructor.error).toBeNull();
      await provideUser({ admin, id, email, password });
    } finally {
      const cleanup = await admin.auth.admin.deleteUser(id);
      expect(cleanup.error).toBeNull();
    }
  },
});
test.skip(process.env.RUN_DEMO_E2E !== "true", "Local Supabase E2E is not enabled");

async function recoveryLink(user: LocalUser) {
  const link = await user.admin.auth.admin.generateLink({ type: "recovery", email: user.email });
  expect(link.error).toBeNull();
  return new URLSearchParams({ type: "recovery", token_hash: link.data.properties!.hashed_token });
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mailadres").fill(email);
  await page.getByLabel("Wachtwoord", { exact: true }).fill(password);
  await page.getByRole("main").getByRole("button", { name: "Inloggen", exact: true }).click();
}

const redirects = [
  { label: "ontbrekende next", query: "", expected: "/dashboard" },
  { label: "interne route met query en fragment", query: "next=%2Fbeschikbaarheid%3Ftab%3Dweek%23regels", expected: "/beschikbaarheid?tab=week#regels" },
  { label: "gecodeerde query blijft intact", query: "next=%2Fdashboard%3Fq%3Dhttps%253A%252F%252Fexample.com", expected: "/dashboard?q=https%3A%2F%2Fexample.com" },
  { label: "absolute externe URL", query: "next=https%3A%2F%2Fevil.example", expected: "/dashboard" },
  { label: "protocol-relative URL", query: "next=%2F%2Fevil.example", expected: "/dashboard" },
  { label: "backslash", query: "next=%2F%5Cevil.example", expected: "/dashboard" },
  { label: "normalisatie naar dubbele slash", query: "next=%2Ffoo%2F..%2F%2Fevil.example", expected: "/dashboard" },
  { label: "gecodeerde dot-segmenten", query: "next=%2F%252e%252e%2F%2Fevil.example", expected: "/dashboard" },
  { label: "dubbel gecodeerde slash", query: "next=%2F%252fevil.example", expected: "/dashboard" },
  { label: "dubbel gecodeerde backslash", query: "next=%2F%255cevil.example", expected: "/dashboard" },
  { label: "genest gemengd gecodeerde slash", query: "next=%2F%2525%2532%2566%2Fevil.example", expected: "/dashboard" },
  { label: "gecodeerde newline", query: "next=%2F%0a%2Fevil.example", expected: "/dashboard" },
];
for (const redirect of redirects) {
  test(`echte auth-confirm redirect: ${redirect.label}`, async ({ request, baseURL, localUser }) => {
    const params = await recoveryLink(localUser);
    const response = await request.get(`/auth/confirm?${params}&${redirect.query}`, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe(new URL(redirect.expected, baseURL).href);
    expect(response.headers()["set-cookie"]).toContain("sb-");
    // Cookies from verifyOtp must authenticate the next protected request.
    const dashboard = await request.get("/dashboard", { maxRedirects: 0 });
    expect(dashboard.status()).toBe(200);
  });
}

test.describe("e-mailbevestiging", () => {
  test.use({ emailConfirmed: false });
  test("e-mailbevestiging bewaart de sessie; een verbruikte token maakt geen nieuwe sessie", async ({ page, browser, baseURL, localUser }) => {
    const link = await localUser.admin.auth.admin.generateLink({
      type: "signup", email: localUser.email, password: localUser.password,
    });
    expect(link.error).toBeNull();
    expect(link.data.user!.email_confirmed_at).toBeFalsy();
    const params = new URLSearchParams({ type: "email", token_hash: link.data.properties!.hashed_token, next: "/beschikbaarheid" });
    const path = `/auth/confirm?${params}`;
    await page.goto(path);
    await expect(page).toHaveURL(/\/beschikbaarheid$/);
    const confirmed = await localUser.admin.auth.admin.getUserById(localUser.id);
    expect(confirmed.data.user!.email_confirmed_at).toBeTruthy();
    await page.reload();
    await expect(page).toHaveURL(/\/beschikbaarheid$/);

    const fresh = await browser.newContext({ baseURL });
    try {
      const replay = await fresh.request.get(path, { maxRedirects: 0 });
      expect(replay.status()).toBe(307);
      expect(replay.headers().location).toBe(new URL("/login?fout=link-verlopen", baseURL).href);
      const protectedPage = await fresh.newPage();
      await protectedPage.goto("/dashboard");
      await expect(protectedPage).toHaveURL(/\/login$/);
    } finally {
      await fresh.close();
    }
    // Replaying the link elsewhere must not destroy the original session.
    await page.goto("/beschikbaarheid");
    await expect(page).toHaveURL(/\/beschikbaarheid$/);
    await page.getByRole("button", { name: /uitloggen/i }).click();
    await page.waitForURL(/\/$/);
    await page.goto("/beschikbaarheid");
    await expect(page).toHaveURL(/\/login$/);
  });
});

test("wachtwoordherstel houdt interne redirect en verandert het echte wachtwoord", async ({ page, localUser }) => {
  await page.goto("/wachtwoord-vergeten");
  await page.getByLabel("E-mailadres").fill(localUser.email);
  await page.getByRole("button", { name: "Stuur herstellink" }).click();
  await expect(page.getByText("Als dit e-mailadres bekend is,", { exact: false })).toBeVisible();

  const params = await recoveryLink(localUser);
  params.set("next", "/wachtwoord-herstellen");
  await page.goto(`/auth/confirm?${params}`);
  await expect(page).toHaveURL(/\/wachtwoord-herstellen$/);
  const password = `Reset-${randomUUID()}-aA1!`;
  await page.getByLabel("Nieuw wachtwoord", { exact: true }).fill(password);
  await page.getByLabel("Herhaal nieuw wachtwoord").fill(password);
  await page.getByRole("button", { name: "Wachtwoord wijzigen" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("button", { name: /uitloggen/i }).click();
  await page.waitForURL(/\/$/);

  await login(page, localUser.email, localUser.password);
  await expect(page.getByText("Inloggen mislukt.", { exact: false })).toBeVisible();
  await login(page, localUser.email, password);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("ontbrekende en ongeldige tokens geven uitsluitend de bestaande foutredirect", async ({ request, baseURL }) => {
  for (const query of [
    "next=https%3A%2F%2Fevil.example", "type=recovery&next=%2Fdashboard",
    "token_hash=invalid", "token_hash=invalid&type=recovery&next=%2F%2Fevil.example",
    "token_hash=invalid&type=unknown&next=%2Fwachtwoord-herstellen",
  ]) {
    const response = await request.get(`/auth/confirm?${query}`, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe(new URL("/login?fout=link-verlopen", baseURL).href);
  }
  const dashboard = await request.get("/dashboard", { maxRedirects: 0 });
  expect(dashboard.status()).toBe(307);
  expect(new URL(dashboard.headers().location, baseURL).href).toBe(new URL("/login", baseURL).href);
});

test("herstel zonder sessie blijft beschermd en onbekende e-mail krijgt hetzelfde antwoord", async ({ page }) => {
  await page.goto("/wachtwoord-herstellen");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/wachtwoord-vergeten");
  await page.getByLabel("E-mailadres").fill(`unknown-${randomUUID()}@example.test`);
  await page.getByRole("button", { name: "Stuur herstellink" }).click();
  await expect(page.getByText("Als dit e-mailadres bekend is,", { exact: false })).toBeVisible();
});
