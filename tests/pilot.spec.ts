import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { devices, expect, test, type Page } from "@playwright/test";

test.skip(process.env.RUN_DEMO_E2E !== "true", "Isolated local Supabase is required");
test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

test("nieuwe sportschool en zzp-instructeur doorlopen de volledige samenwerking", async ({ page: school, browser }, testInfo) => {
  test.setTimeout(180_000);
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } });
  const instructorContext = await browser.newContext({
    ...(testInfo.project.name === "mobile" ? devices["Pixel 7"] : devices["Desktop Chrome"]),
    baseURL: testInfo.project.use.baseURL,
  });
  const instructor = await instructorContext.newPage();
  const nonce = randomUUID();
  const schoolEmail = `pilot-school-${nonce}@example.test`;
  const instructorEmail = `pilot-instructor-${nonce}@example.test`;
  const title = `Pilottraining ${nonce.slice(0, 8)}`;
  const password = `Pilot-${nonce}-aA1!`;

  async function register(page: Page, role: "organization" | "instructor", email: string) {
    await page.goto("/registreren");
    await page.getByRole("button", { name: role === "organization" ? "Ik zoek instructeurs" : "Ik ben instructeur" }).click();
    await page.getByLabel(role === "organization" ? "Naam contactpersoon" : "Volledige naam").fill(`CI Pilot ${role}`);
    await page.getByLabel("E-mailadres").fill(email);
    await page.getByLabel("Wachtwoord", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Gratis account aanmaken" }).click();
    await page.waitForURL("**/onboarding");
  }

  try {
    await register(school, "organization", schoolEmail);
    await school.getByLabel("Bedrijfsnaam").fill(`CI Pilot ${nonce}`);
    await school.getByLabel("Type organisatie").selectOption("gym");
    await school.getByLabel("Telefoonnummer").fill("0301234567");
    await school.getByLabel("Naam vestiging").fill("Pilot Centrum");
    await school.getByLabel("Plaats", { exact: true }).selectOption({ label: "Utrecht" });
    await school.getByLabel("Straat", { exact: true }).fill("Teststraat");
    await school.getByLabel("Nr.", { exact: true }).fill("1");
    await school.getByLabel("Postcode").fill("1234 AB");
    await school.getByRole("button", { name: "Organisatie aanmaken" }).click();
    await school.waitForURL("**/dashboard");

    await register(instructor, "instructor", instructorEmail);
    await instructor.getByLabel("Telefoonnummer").fill("0612345678");
    await instructor.getByLabel("Geboortedatum").fill("1990-01-01");
    await instructor.getByLabel("Woonplaats", { exact: true }).selectOption({ label: "Utrecht" });
    await instructor.getByLabel("Uurtarief (€, excl. btw)").fill("45");
    await instructor.getByLabel("Jaren ervaring").fill("5");
    await instructor.getByText("Zzp'er", { exact: true }).click();
    await expect(instructor.getByLabel("Zzp'er", { exact: true })).toBeChecked();
    await instructor.getByLabel("KvK-nummer", { exact: true }).fill("12345678");
    await instructor.getByText("Fitness", { exact: true }).click();
    await expect(instructor.getByLabel("Fitness", { exact: true })).toBeChecked();
    await instructor.getByLabel("Werkervaring", { exact: true }).fill("Vijf jaar groepslessen. Geïsoleerde pilotfixture.");
    await instructor.getByRole("button", { name: "Profiel opslaan en starten" }).click();
    await instructor.waitForURL("**/dashboard");

    const instructorProfile = await admin.from("profiles").select("id,demo_session_id").eq("email", instructorEmail).single();
    expect(instructorProfile.error).toBeNull();
    const instructorId = instructorProfile.data!.id;
    expect(instructorProfile.data!.demo_session_id).toBeNull();
    // Synthetic approved document, never a real user's VOG or production data.
    expect((await admin.from("document_uploads").insert({ user_id: instructorId, doc_type: "vog",
      storage_path: `tests/${nonce}/vog.pdf`, original_filename: "synthetic-vog.pdf", status: "approved",
      expires_at: "2099-01-01" })).error).toBeNull();

    await school.goto("/organisatie/opdrachten/nieuw");
    await school.getByLabel("Soort plaatsing").selectOption("one_time");
    await school.getByLabel("Vestiging", { exact: true }).selectOption({ index: 1 });
    await school.getByLabel("Sport", { exact: true }).selectOption({ label: "Fitness" });
    await school.getByLabel("Soort les").selectOption({ index: 1 });
    await school.getByLabel("Titel", { exact: true }).fill(title);
    await school.getByLabel("Beschrijving", { exact: true }).fill("Volledige samenwerking met tijdelijke testaccounts in lokale Supabase.");
    await school.getByLabel("Datum", { exact: true }).fill(new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10));
    await school.getByLabel("Begintijd").fill("10:00");
    await school.getByLabel("Eindtijd").fill("11:00");
    await school.getByLabel("Uurtarief (€)").fill("45");
    await school.getByRole("button", { name: "Opdracht plaatsen", exact: true }).click();
    await expect(school.getByRole("heading", { name: title, exact: true })).toBeVisible();
    const jobId = new URL(school.url()).pathname.split("/").pop()!;

    // A different role/session cannot enter organization management.
    await instructor.goto(`/organisatie/opdrachten/${jobId}`);
    await instructor.waitForURL("**/dashboard");
    await instructor.goto("/opdrachten");
    await instructor.getByRole("link").filter({ hasText: title }).first().click();
    await expect(instructor.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await instructor.getByLabel("Kort bericht (optioneel)").fill("Ik verzorg deze training graag.");
    await instructor.getByRole("button", { name: "Ik ben beschikbaar", exact: true }).click();
    await expect(instructor.getByText("Je reactie is verstuurd!", { exact: true })).toBeVisible();

    await school.reload();
    await school.getByRole("button", { name: "Deze kandidaat kiezen", exact: true }).click();
    await school.getByRole("button", { name: "Akkoord en kandidaat kiezen", exact: true }).click();
    await expect(school.getByText("Kandidaat gekozen. De opdracht is definitief zodra de instructeur bevestigt.", { exact: true })).toBeVisible();
    await instructor.reload();
    await instructor.getByRole("button", { name: "Ik ga akkoord — opdracht bevestigen", exact: true }).click();
    await expect(instructor.getByText("Opdracht bevestigd! Contactgegevens zijn nu zichtbaar.", { exact: true })).toBeVisible();
    const confirmation = await admin.from("job_confirmations").select("organization_agreed_at,instructor_agreed_at,confirmed_at")
      .eq("job_id", jobId).single();
    expect(confirmation.error).toBeNull();
    expect(confirmation.data!.organization_agreed_at).toBeTruthy();
    expect(confirmation.data!.instructor_agreed_at).toBeTruthy();
    expect(confirmation.data!.confirmed_at).toBeTruthy();

    for (const participant of [school, instructor]) {
      await participant.goto("/agenda");
      await participant.getByRole("button", { name: "Lijst", exact: true }).click();
      await expect(participant.getByText(title, { exact: true })).toBeVisible();
      await participant.goto("/meldingen");
      await expect(participant.getByRole("heading", { name: "Meldingen", exact: true })).toBeVisible();
      await expect(participant.getByText(title, { exact: false }).first()).toBeVisible();
    }
    const chat = await admin.from("chats").select("id").eq("job_id", jobId).eq("instructor_id", instructorId).single();
    expect(chat.error).toBeNull();
    await school.goto(`/berichten/${chat.data!.id}`);
    await school.getByPlaceholder("Typ een bericht…").fill("Tot bij de pilottraining!");
    await school.getByRole("button", { name: "Versturen", exact: true }).click();
    await expect(school.getByText("Tot bij de pilottraining!", { exact: true })).toBeVisible();
    await instructor.goto(`/berichten/${chat.data!.id}`);
    await expect(instructor.getByText("Tot bij de pilottraining!", { exact: true })).toBeVisible();
    await instructor.getByPlaceholder("Typ een bericht…").fill("Afgesproken, tot dan!");
    await instructor.getByRole("button", { name: "Versturen", exact: true }).click();
    await expect(school.getByText("Afgesproken, tot dan!", { exact: true })).toBeVisible({ timeout: 15_000 });

    await school.goto(`/organisatie/opdrachten/${jobId}`);
    await school.getByRole("button", { name: "Opdracht afronden", exact: true }).click();
    await expect(school.getByText("Beoordeel de instructeur", { exact: true })).toBeVisible();
    await school.getByRole("button", { name: "5 sterren", exact: true }).click();
    await school.getByRole("button", { name: "Beoordeling versturen", exact: true }).click();
    await expect(school.getByText("Bedankt voor je beoordeling!", { exact: true })).toBeVisible();
    const firstReview = await admin.from("reviews").select("released_at").eq("job_id", jobId).single();
    expect(firstReview.error).toBeNull();
    expect(firstReview.data!.released_at).toBeNull();
    await instructor.goto(`/opdrachten/${jobId}`);
    await instructor.getByRole("button", { name: "5 sterren", exact: true }).click();
    await instructor.getByRole("button", { name: "Beoordeling versturen", exact: true }).click();
    await expect(instructor.getByText("Bedankt voor je beoordeling!", { exact: true })).toBeVisible();
    const reviews = await admin.from("reviews").select("side,released_at").eq("job_id", jobId);
    expect(reviews.error).toBeNull();
    expect(reviews.data).toHaveLength(2);
    expect(reviews.data!.every(review => review.released_at)).toBe(true);
    await instructor.screenshot({ path: testInfo.outputPath("pilot-instructor-completed.png"), fullPage: true });
    await school.reload();
    await expect(school.getByText("Beoordelingen", { exact: true })).toBeVisible();
    await school.screenshot({ path: testInfo.outputPath("pilot-school-completed.png"), fullPage: true });
  } finally {
    // Playwright may already close this context after a test timeout. Still run
    // account cleanup and preserve the original failing action in the report.
    await instructorContext.close().catch(() => undefined);
    const users = await admin.from("profiles").select("id").in("email", [schoolEmail, instructorEmail]);
    expect(users.error).toBeNull();
    for (const user of users.data ?? []) {
      const orgs = await admin.from("organizations").select("id").eq("created_by", user.id);
      for (const org of orgs.data ?? []) {
        expect((await admin.from("jobs").delete().eq("organization_id", org.id)).error).toBeNull();
        expect((await admin.from("organizations").delete().eq("id", org.id)).error).toBeNull();
      }
      expect((await admin.auth.admin.deleteUser(user.id)).error).toBeNull();
    }
  }
});
