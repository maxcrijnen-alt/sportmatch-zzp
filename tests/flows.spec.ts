import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Deze suite gebruikt uitsluitend tijdelijke, per-browser demosessies. Er
 * staan bewust geen vaste gebruikersnamen, wachtwoorden of productie-fixtures
 * in de tests. Zet RUN_DEMO_E2E=true in een geïsoleerde testomgeving met de
 * vereiste Supabase servervariabelen om de suite uit te voeren.
 */
const demoReady = process.env.RUN_DEMO_E2E === "true";

test.skip(!demoReady, "Tijdelijke demo-E2E is niet ingeschakeld");

async function startDemo(
  page: Page,
  role: "sportschool" | "instructeur",
) {
  await page.goto("/demo");
  await page
    .getByRole("button", { name: `Start demo als ${role}` })
    .click();
  await page.waitForURL("**/dashboard", { timeout: 45_000 });
}

async function createSimpleJob(page: Page, title: string) {
  await page.goto("/organisatie/opdrachten/nieuw");
  await page.getByLabel("Soort plaatsing").selectOption("one_time");
  await page.getByLabel("Vestiging").selectOption({ index: 1 });
  await page.getByLabel("Sport").selectOption({ index: 1 });
  await page.getByLabel("Soort les").selectOption({ index: 1 });
  await page.getByLabel("Titel").fill(title);
  await page
    .getByLabel("Beschrijving")
    .fill("Tijdelijke opdracht voor de geïsoleerde Playwright-demosessie.");
  const nextWeek = new Date(Date.now() + 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  await page.getByLabel("Datum").fill(nextWeek);
  await page.getByLabel("Begintijd").fill("10:00");
  await page.getByLabel("Eindtijd").fill("11:00");
  await page.getByLabel("Uurtarief (€)").fill("45");
  await page.getByRole("button", { name: "Opdracht plaatsen" }).click();
  await page.waitForURL("**/organisatie/opdrachten/**", { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

async function closeDemo(page: Page) {
  await page.getByRole("button", { name: /uitloggen/i }).click();
  await page.waitForURL(/\/$/, { timeout: 30_000 });
}

test("twee gelijktijdige demosessies zien elkaars wijzigingen niet", async ({
  browser,
}: {
  browser: Browser;
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const uniqueTitle = `Alleen sessie A ${Date.now()}`;

  try {
    await Promise.all([
      startDemo(pageA, "sportschool"),
      startDemo(pageB, "sportschool"),
    ]);
    await createSimpleJob(pageA, uniqueTitle);

    await pageB.goto("/organisatie/opdrachten");
    await expect(pageB.getByText(uniqueTitle, { exact: true })).toHaveCount(0);

    await pageA.goto("/organisatie/opdrachten");
    await expect(pageA.getByText(uniqueTitle, { exact: true })).toBeVisible();
  } finally {
    await Promise.allSettled([closeDemo(pageA), closeDemo(pageB)]);
    await Promise.all([contextA.close(), contextB.close()]);
  }
});

test("uitloggen en opnieuw starten levert een schone demo op", async ({ page }) => {
  const uniqueTitle = `Verdwijnt bij reset ${Date.now()}`;
  await startDemo(page, "sportschool");
  await createSimpleJob(page, uniqueTitle);
  await closeDemo(page);

  await startDemo(page, "sportschool");
  await page.goto("/organisatie/opdrachten");
  await expect(page.getByText(uniqueTitle, { exact: true })).toHaveCount(0);
  await closeDemo(page);
});

test("sportschooldemo bevat kandidaten, agenda en alle berichtfilters", async ({
  page,
}) => {
  await startDemo(page, "sportschool");

  await page.goto("/organisatie/kandidaten");
  await expect(page.getByText("Eerste klus").first()).toBeVisible();
  await expect(page.getByText(/Eerder mee samengewerkt/i)).toBeVisible();

  await page.goto("/agenda");
  await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible();
  await expect(page.getByText(/Bevestigde training/i).first()).toBeVisible();

  await page.goto("/berichten");
  for (const tab of ["Binnengekomen", "Verzonden", "Uitnodigingen", "Afgerond"]) {
    await expect(page.getByRole("link", { name: new RegExp(tab) })).toBeVisible();
  }
  await closeDemo(page);
});

test("opdracht ondersteunt eigen lesvorm, herhaling, blok en sjabloon", async ({
  page,
}) => {
  await startDemo(page, "sportschool");
  await page.goto("/organisatie/opdrachten/nieuw");

  await page.getByLabel("Soort plaatsing").selectOption("recurring");
  await page.getByLabel("Vestiging").selectOption({ index: 1 });
  await page.getByLabel("Sport").selectOption({ index: 1 });
  await page.getByLabel("Soort les").selectOption("custom");
  await page.getByLabel("Eigen lesvorm").fill("Mobiliteitstraining");
  await page.getByLabel("Titel").fill("Terugkerend lessenblok");
  await page
    .getByLabel("Beschrijving")
    .fill("Een reproduceerbare opdracht met twee direct aansluitende lessen.");
  const nextWeek = new Date(Date.now() + 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  await page.getByLabel("Eerste datum").fill(nextWeek);
  await page.getByLabel("Begintijd").fill("18:00");
  await page.getByLabel("Eindtijd").fill("20:00");
  await page.getByLabel("Omschrijving herhaling").fill("Iedere dinsdagavond");
  await page.getByLabel("Uurtarief (€)").fill("50");
  await page.getByLabel("Meerdere aansluitende lessen plaatsen").check();
  await page.getByLabel("Lesvorm les 1").selectOption("custom");
  await page.getByLabel("Eigen lesvorm les 1").fill("Mobiliteit en herstel");
  await page.getByLabel("Lesvorm les 2").selectOption({ index: 1 });
  await page.getByLabel("Gedeeltelijk overnemen toegestaan").check();
  await page.getByLabel("Deze keuzes ook als sjabloon opslaan").check();
  await page.getByPlaceholder("Naam van het sjabloon (optioneel)").fill(
    "Avondblok",
  );

  await page.getByRole("button", { name: "Opdracht plaatsen" }).click();
  await page.waitForURL("**/organisatie/opdrachten/**", { timeout: 30_000 });
  await expect(page.getByText("Terugkerend lessenblok")).toBeVisible();
  await expect(page.getByText("Mobiliteit en herstel")).toBeVisible();
  await expect(page.getByRole("button", { name: "Opslaan als sjabloon" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Opdracht dupliceren" })).toBeVisible();
  await closeDemo(page);
});

test("instructeursdemo toont verticale opdrachten, reviews en geldige VOG", async ({
  page,
}) => {
  await startDemo(page, "instructeur");
  await page.goto("/opdrachten");
  await expect(page.getByText(/Afstand onbekend|km/).first()).toBeVisible();
  await expect(page.getByText("Goedgekeurde VOG nodig")).toHaveCount(0);

  await page.goto("/reviews");
  await expect(page.getByText("Ontvangen beoordelingen")).toBeVisible();
  await expect(page.getByText("Betrouwbaarheid")).toBeVisible();
  await closeDemo(page);
});
