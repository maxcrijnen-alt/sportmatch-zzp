import { expect, test, type Page } from "@playwright/test";

/**
 * End-to-end-flows tegen een geconfigureerde Supabase-omgeving met demo-data
 * (npm run seed:demo). Deze tests worden overgeslagen zonder Supabase-config.
 */

const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const PASSWORD = process.env.DEMO_PASSWORD ?? "SportMatch2026!";

test.skip(!hasSupabase, "Supabase is niet geconfigureerd");

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-mailadres").fill(email);
  await page.getByLabel("Wachtwoord").fill(PASSWORD);
  await page.getByRole("main").getByRole("button", { name: "Inloggen" }).click();
  await page.waitForURL("**/dashboard", { timeout: 20_000 });
}

test.describe("instructeur", () => {
  test("kan inloggen en het dashboard zien", async ({ page }) => {
    await login(page, "instructeur@sportmatch.test");
    await expect(page.getByRole("heading", { name: /Hoi / })).toBeVisible();
  });

  test("ziet passende opdrachten met matchscore en kan filteren", async ({
    page,
  }) => {
    await login(page, "instructeur@sportmatch.test");
    await page.goto("/opdrachten");
    await expect(page.getByText(/Match \d+%/).first()).toBeVisible();

    // Filter op spoed
    await page.getByLabel("Soort").selectOption("urgent_substitute");
    await page.getByRole("button", { name: "Filteren" }).click();
    await expect(page.getByText("Spoed-inval").first()).toBeVisible();
  });

  test("kan een opdrachtdetail openen en het reactieformulier zien", async ({
    page,
  }) => {
    await login(page, "instructeur@sportmatch.test");
    await page.goto("/opdrachten");
    await page
      .locator("a[href^='/opdrachten/']")
      .first()
      .click();
    await expect(page.getByText("Vergoeding")).toBeVisible();
  });

  test("ziet reacties en tegenvoorstellen onder mijn-reacties", async ({
    page,
  }) => {
    await login(page, "instructeur2@sportmatch.test");
    await page.goto("/mijn-reacties");
    await expect(page.getByText("Reacties")).toBeVisible();
  });

  test("kan beschikbaarheid beheren", async ({ page }) => {
    await login(page, "instructeur@sportmatch.test");
    await page.goto("/beschikbaarheid");
    await expect(
      page.getByRole("heading", { name: "Beschikbaarheid" }),
    ).toBeVisible();
    await expect(page.getByText("Dinsdag").first()).toBeVisible();
  });

  test("ziet documentstatussen en badges", async ({ page }) => {
    await login(page, "instructeur@sportmatch.test");
    await page.goto("/documenten");
    await expect(page.getByText("Goedgekeurd").first()).toBeVisible();
    await expect(page.getByText("In afwachting").first()).toBeVisible();
  });

  test("ziet reviews en betrouwbaarheidsscore", async ({ page }) => {
    await login(page, "instructeur@sportmatch.test");
    await page.goto("/reviews");
    await expect(page.getByText("Betrouwbaarheid")).toBeVisible();
    await expect(page.getByText("Ontvangen beoordelingen")).toBeVisible();
  });

  test("kan chatten in een bestaand gesprek", async ({ page }) => {
    await login(page, "instructeur@sportmatch.test");
    await page.goto("/berichten");
    await page.locator("a[href^='/berichten/']").first().click();
    const message = `Testbericht ${Date.now()}`;
    await page.getByPlaceholder("Typ een bericht…").fill(message);
    await page.getByRole("button", { name: "Versturen" }).click();
    await expect(page.getByText(message)).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("organisatie", () => {
  test("kan inloggen en opdrachten beheren", async ({ page }) => {
    await login(page, "sportschool@sportmatch.test");
    await page.goto("/organisatie/opdrachten");
    await expect(page.getByRole("heading", { name: "Opdrachten" })).toBeVisible();
    await expect(page.getByText("Spoed-inval").first()).toBeVisible();
  });

  test("kan een nieuwe opdracht plaatsen", async ({ page }) => {
    await login(page, "sportschool@sportmatch.test");
    await page.goto("/organisatie/opdrachten/nieuw");

    await page.getByLabel("Soort plaatsing").selectOption("one_time");
    await page.getByLabel("Sport / soort les").selectOption({ index: 1 });
    await page.getByLabel("Vestiging").selectOption({ index: 1 });
    await page.getByLabel("Titel").fill("E2E-test opdracht");
    await page
      .getByLabel("Beschrijving")
      .fill("Automatisch aangemaakt door de E2E-test.");

    const nextWeek = new Date(Date.now() + 7 * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
    await page.getByLabel(/Datum/).fill(nextWeek);
    await page.getByLabel("Begintijd").fill("10:00");
    await page.getByLabel("Eindtijd").fill("11:00");
    await page.getByLabel("Uurtarief (€)").fill("45");

    await page.getByRole("button", { name: "Opdracht plaatsen" }).click();
    await page.waitForURL("**/organisatie/opdrachten/**", { timeout: 20_000 });
    await expect(page.getByText("E2E-test opdracht")).toBeVisible();
  });

  test("ziet kandidaten met betrouwbaarheidsstatistieken", async ({ page }) => {
    await login(page, "sportschool@sportmatch.test");
    await page.goto("/organisatie/kandidaten");
    await expect(page.getByRole("heading", { name: "Kandidaten" })).toBeVisible();
  });

  test("planner heeft toegang tot de organisatie", async ({ page }) => {
    await login(page, "planner@sportmatch.test");
    await page.goto("/organisatie");
    await expect(page.getByText("FitZone Utrecht").first()).toBeVisible();
  });

  test("ziet vestigingen met abonnementsstatus", async ({ page }) => {
    await login(page, "sportschool@sportmatch.test");
    await page.goto("/organisatie/vestigingen");
    await expect(page.getByText("Proefperiode").first()).toBeVisible();
  });
});

test.describe("rolgebaseerde toegang", () => {
  test("instructeur wordt weggestuurd van organisatiepagina's", async ({
    page,
  }) => {
    await login(page, "instructeur@sportmatch.test");
    await page.goto("/organisatie/opdrachten/nieuw");
    await page.waitForURL("**/dashboard");
  });

  test("niet-admin wordt weggestuurd van admin", async ({ page }) => {
    await login(page, "instructeur@sportmatch.test");
    await page.goto("/admin");
    await page.waitForURL("**/dashboard");
  });
});

test.describe("admin", () => {
  test("ziet statistieken", async ({ page }) => {
    await login(page, "admin@sportmatch.test");
    await page.waitForURL("**/admin");
    await expect(page.getByText("Instructeurs")).toBeVisible();
    await expect(page.getByText("Actieve abonnementen")).toBeVisible();
  });

  test("kan documenten beoordelen", async ({ page }) => {
    await login(page, "admin@sportmatch.test");
    await page.goto("/admin/documenten");
    await expect(
      page.getByRole("heading", { name: "Documentcontrole" }),
    ).toBeVisible();

    const pendingSection = page.getByText(/Te beoordelen \(\d+\)/);
    await expect(pendingSection).toBeVisible();

    const approveButton = page.getByRole("button", { name: "Goedkeuren" }).first();
    if (await approveButton.isVisible().catch(() => false)) {
      await approveButton.click();
      await expect(page.getByText("Goedgekeurd").first()).toBeVisible({
        timeout: 15_000,
      });
    }
  });

  test("kan billingstatus wijzigen", async ({ page }) => {
    await login(page, "admin@sportmatch.test");
    await page.goto("/admin/billing");
    await expect(page.getByText("Abonnementen")).toBeVisible();
    await expect(page.getByText("Conversievergoedingen")).toBeVisible();
  });
});

test.describe("registratie", () => {
  test("nieuwe instructeur kan registreren en komt in onboarding", async ({
    page,
  }) => {
    const email = `e2e-${Date.now()}@sportmatch.test`;
    await page.goto("/registreren");
    await page.getByRole("button", { name: "Ik ben instructeur" }).click();
    await page.getByLabel(/naam/i).fill("E2E Tester");
    await page.getByLabel("E-mailadres").fill(email);
    await page.getByLabel("Wachtwoord").fill(PASSWORD);
    await page
      .getByRole("button", { name: "Gratis account aanmaken" })
      .click();
    await page.waitForURL("**/onboarding", { timeout: 20_000 });
    await expect(page.getByText("instructeursprofiel", { exact: false })).toBeVisible();
  });
});
