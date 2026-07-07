import { expect, test } from "@playwright/test";

// Publieke pagina's: werken ook zonder Supabase-configuratie.

test("homepage toont propositie en CTA's", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1 }),
  ).toContainText("sportinstructeur");
  await expect(
    page.getByRole("link", { name: "Start als instructeur" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Start als sportschool" }).first(),
  ).toBeVisible();
});

test("homepage toont juridische disclaimer", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("geen juridisch of fiscaal", { exact: false }).first())
    .toBeVisible();
});

for (const [path, heading] of [
  ["/hoe-het-werkt", "Hoe het werkt"],
  ["/voor-instructeurs", "Meer opdrachten"],
  ["/voor-sportscholen", "lesuitval"],
  ["/tarieven", "Tarieven"],
  ["/faq", "Veelgestelde vragen"],
  ["/privacy", "Privacybeleid"],
  ["/voorwaarden", "Algemene voorwaarden"],
] as const) {
  test(`pagina ${path} rendert`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(heading, {
      ignoreCase: true,
    });
  });
}

test("tarieven noemt prijs en proefperiode", async ({ page }) => {
  await page.goto("/tarieven");
  await expect(page.getByText("€ 5").first()).toBeVisible();
  await expect(page.getByText("30 dagen").first()).toBeVisible();
});

test("loginpagina toont formulier", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("E-mailadres")).toBeVisible();
  await expect(page.getByLabel("Wachtwoord")).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("button", { name: "Inloggen" }),
  ).toBeVisible();
});

test("registratiepagina toont rolkeuze", async ({ page }) => {
  await page.goto("/registreren");
  await expect(page.getByRole("button", { name: "Ik ben instructeur" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ik zoek instructeurs" }),
  ).toBeVisible();
});

test("beschermde route stuurt door naar login", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForURL("**/login");
  await expect(
    page.getByRole("main").getByRole("button", { name: "Inloggen" }),
  ).toBeVisible();
});
