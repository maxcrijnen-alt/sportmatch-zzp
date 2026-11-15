import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { dateInAmsterdam } from "@/lib/datetime/amsterdam";
import { addCalendarDays } from "@/lib/jobs/schedule";

test.skip(
  process.env.RUN_DEMO_E2E !== "true",
  "Isolated local Supabase is required",
);

const BULK = 105;

async function inBatches<T>(items: T[], size: number, run: (item: T) => Promise<void>) {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(run));
  }
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test("kandidaten zoeken, filteren, sorteren, pagineren en uitnodigen over de volledige set", async ({
  page,
}, testInfo) => {
  test.setTimeout(300_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const nonce = randomUUID().slice(0, 8);
  const prefix = `Discovery ${nonce}`;
  const password = `Discovery-${randomUUID()}-aA1!`;
  const userIds: string[] = [];
  const orgIds: string[] = [];
  const results = page.locator("#zoeken");
  const cards = results.getByTestId("candidate-card");
  const status = results.getByRole("status");

  async function createUser(email: string, role: string, fullName: string) {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role, full_name: fullName },
    });
    expect(created.error).toBeNull();
    userIds.push(created.data.user!.id);
    return created.data.user!.id;
  }

  async function signedInClient(email: string): Promise<SupabaseClient> {
    const client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    expect((await client.auth.signInWithPassword({ email, password })).error).toBeNull();
    return client;
  }

  async function cardNames() {
    return cards.getByRole("heading", { level: 3 }).allInnerTexts();
  }

  const q = (extra = "") => `/organisatie/kandidaten?q=${encodeURIComponent(prefix)}${extra}`;

  try {
    // -----------------------------------------------------------------------
    // Synthetic fixtures (local stack only).
    // -----------------------------------------------------------------------
    const ownerEmail = `discovery-owner-${nonce}@example.test`;
    const otherOwnerEmail = `discovery-other-${nonce}@example.test`;
    const ownerId = await createUser(ownerEmail, "organization", `${prefix} Owner`);
    const otherOwnerId = await createUser(otherOwnerEmail, "organization", `${prefix} Other`);
    const alphaEmail = `discovery-alpha-${nonce}@example.test`;
    const alphaId = await createUser(alphaEmail, "instructor", `${prefix} Alpha`);
    const newId = await createUser(`discovery-new-${nonce}@example.test`, "instructor", `${prefix} Nieuw`);
    const bulkIds: string[] = [];
    await inBatches(
      Array.from({ length: BULK }, (_, index) => index + 1),
      10,
      async (n) => {
        const id = await createUser(
          `discovery-bulk-${n}-${nonce}@example.test`,
          "instructor",
          `${prefix} Bulk ${String(n).padStart(3, "0")}`,
        );
        bulkIds[n - 1] = id;
      },
    );
    const instructorIds = [alphaId, newId, ...bulkIds];

    const lookups = await Promise.all([
      admin.from("cities").select("id").eq("name", "Utrecht").single(),
      admin.from("sports").select("id").eq("slug", "fitness").single(),
      admin.from("sports").select("id").eq("slug", "spinning").single(),
      admin.from("lesson_types").select("id, sport:sports!inner(slug)").eq("name", "Krachttraining")
        .eq("sport.slug", "fitness").single(),
    ]);
    for (const lookup of lookups) expect(lookup.error).toBeNull();
    const [city, fitness, spinning, kracht] = lookups.map((lookup) => lookup.data!.id as string);

    expect((await admin.from("profiles").update({ onboarding_completed: true, city_id: city })
      .in("id", [ownerId, otherOwnerId, alphaId, ...bulkIds])).error).toBeNull();
    expect((await admin.from("profiles").update({ onboarding_completed: true, custom_city: "Onbekend Dorp" })
      .eq("id", newId)).error).toBeNull();
    expect((await admin.from("instructor_profiles").insert(instructorIds.map((id, index) => ({
      user_id: id,
      years_experience: id === alphaId ? 20 : id === newId ? 0 : (index - 1) % 15,
      travel_distance_km: 40,
    })))).error).toBeNull();
    expect((await admin.from("instructor_sports").insert([
      ...instructorIds.map((id) => ({ user_id: id, sport_id: fitness })),
      { user_id: alphaId, sport_id: spinning },
    ])).error).toBeNull();
    expect((await admin.from("instructor_lesson_types").insert({ user_id: alphaId, lesson_type_id: kracht }))
      .error).toBeNull();
    expect((await admin.from("document_uploads").insert(instructorIds.map((id) => ({
      user_id: id,
      doc_type: "vog",
      storage_path: `tests/discovery/${nonce}/${id}.pdf`,
      original_filename: "synthetic.pdf",
      status: "approved",
      expires_at: "2099-01-01",
    })))).error).toBeNull();

    for (const [creator, name] of [[ownerId, "A"], [otherOwnerId, "B"]] as const) {
      const org = await admin.from("organizations")
        .insert({ name: `${prefix} Gym ${name}`, org_type: "gym", created_by: creator })
        .select("id").single();
      expect(org.error).toBeNull();
      orgIds.push(org.data!.id);
      expect((await admin.from("organization_members")
        .insert({ organization_id: org.data!.id, user_id: creator, member_role: "owner" })).error).toBeNull();
    }
    const locations = await admin.from("organization_locations").insert([
      { organization_id: orgIds[0], name: "Centrum", city_id: city },
      { organization_id: orgIds[1], name: "Elders", city_id: city },
    ]).select("id, organization_id");
    expect(locations.error).toBeNull();
    const locationA = locations.data!.find((row) => row.organization_id === orgIds[0])!.id;
    const locationB = locations.data!.find((row) => row.organization_id === orgIds[1])!.id;

    // A future Wednesday for the open job; Alpha's weekly rule covers it.
    let jobDate = addCalendarDays(dateInAmsterdam(new Date()), 14);
    while (new Date(`${jobDate}T12:00:00Z`).getUTCDay() !== 3) jobDate = addCalendarDays(jobDate, 1);
    const baseJob = {
      job_type: "one_time", sport_id: fitness, start_time: "10:00", end_time: "11:00",
      pay_type: "hourly", pay_hourly_rate_cents: 4500,
    };
    const jobs = await admin.from("jobs").insert([
      { ...baseJob, organization_id: orgIds[0], location_id: locationA, created_by: ownerId,
        title: `${prefix} Open`, starts_on: jobDate, status: "open" },
      { ...baseJob, organization_id: orgIds[0], location_id: locationA, created_by: ownerId,
        title: `${prefix} Done`, starts_on: addCalendarDays(dateInAmsterdam(new Date()), -7), status: "completed" },
      { ...baseJob, organization_id: orgIds[1], location_id: locationB, created_by: otherOwnerId,
        title: `${prefix} Other`, starts_on: jobDate, status: "open" },
    ]).select("id, title");
    expect(jobs.error).toBeNull();
    const jobId = (title: string) => jobs.data!.find((job) => job.title === `${prefix} ${title}`)!.id;
    const openJob = jobId("Open");
    const doneJob = jobId("Done");
    const otherJob = jobId("Other");

    // Alpha: completed collaboration with a released 5-star review.
    const application = await admin.from("job_applications")
      .insert({ job_id: doneJob, instructor_id: alphaId, status: "accepted" }).select("id").single();
    expect(application.error).toBeNull();
    const now = new Date().toISOString();
    expect((await admin.from("job_confirmations").insert({
      job_id: doneJob, application_id: application.data!.id, instructor_id: alphaId, terms: {},
      organization_agreed_at: now, organization_agreed_by: ownerId, instructor_agreed_at: now, confirmed_at: now,
    })).error).toBeNull();
    expect((await admin.from("reviews").insert([
      { job_id: doneJob, reviewer_id: ownerId, reviewee_id: alphaId, side: "organization", rating: 5, released_at: now },
      { job_id: doneJob, reviewer_id: alphaId, reviewee_id: ownerId, side: "instructor", rating: 5, released_at: now },
    ])).error).toBeNull();
    expect((await admin.from("availability_rules")
      .insert({ user_id: alphaId, weekday: 3, start_time: "08:00", end_time: "12:00" })).error).toBeNull();

    const total = BULK + 2;
    const pages = Math.ceil(total / 20);

    // -----------------------------------------------------------------------
    // Login and the complete result set (beyond the old 100 / 12 / 6 limits).
    // -----------------------------------------------------------------------
    await page.goto("/login");
    await page.getByLabel("E-mailadres", { exact: true }).fill(ownerEmail);
    await page.getByLabel("Wachtwoord", { exact: true }).fill(password);
    await page.getByRole("main").getByRole("button", { name: "Inloggen", exact: true }).click();
    await page.waitForURL("**/dashboard");

    await page.goto("/organisatie/kandidaten");
    await page.getByRole("searchbox").fill(prefix);
    await page.getByRole("button", { name: "Filters toepassen" }).click();
    await page.waitForURL(/q=Discovery/);
    await expect(status).toContainText(`${total} kandidaten gevonden`);
    await expect(cards).toHaveCount(20);
    await expect(results.getByText(`1–20 van ${total}`)).toBeVisible();
    await expect(results.getByText(`Pagina 1 van ${pages}`)).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: testInfo.outputPath("candidates-overview.png"), fullPage: true });

    // Paging: every candidate exactly once, in a stable order.
    const seen: string[] = [];
    for (let pageNumber = 1; pageNumber <= pages; pageNumber++) {
      await page.goto(q(`&pagina=${pageNumber}`));
      await expect(results.getByText(`Pagina ${pageNumber} van ${pages}`)).toBeVisible();
      seen.push(...(await cardNames()));
    }
    expect(seen).toHaveLength(total);
    expect(new Set(seen).size).toBe(total);
    await page.goto(q());
    await results.getByRole("link", { name: "Volgende" }).click();
    await page.waitForURL(/pagina=2/);
    await expect(results.getByText(`21–40 van ${total}`)).toBeVisible();
    expect(await cardNames()).toEqual(seen.slice(20, 40));
    // A page beyond the end falls back to the last page.
    await page.goto(q("&pagina=999"));
    await expect(results.getByText(`Pagina ${pages} van ${pages}`)).toBeVisible();

    // -----------------------------------------------------------------------
    // Name, sport and lesson type, and combinations.
    // -----------------------------------------------------------------------
    await page.goto(`/organisatie/kandidaten?q=${encodeURIComponent(`${nonce} alpha`.toUpperCase())}`);
    await expect(status).toContainText("1 kandidaat gevonden");
    await page.goto(q(`&sport=${spinning}`));
    expect(await cardNames()).toEqual([`${prefix} Alpha`]);
    await page.goto(q(`&lesvorm=${kracht}`));
    expect(await cardNames()).toEqual([`${prefix} Alpha`]);
    await page.goto(q(`&sport=${fitness}&minErvaring=10&sorteer=ervaring`));
    await expect(status).toContainText("36 kandidaten gevonden");
    expect((await cardNames())[0]).toBe(`${prefix} Alpha`);
    await expect(results.getByText(/3 filters actief/)).toBeVisible();

    // -----------------------------------------------------------------------
    // Ratings, reliability and unknown values.
    // -----------------------------------------------------------------------
    await page.goto(q("&minSterren=4"));
    expect(await cardNames()).toEqual([`${prefix} Alpha`]);
    await page.goto(q("&minSterren=4&metNieuw=1"));
    await expect(status).toContainText(`${total} kandidaten gevonden`);
    await page.goto(q("&sorteer=beoordeling"));
    const firstCard = cards.first();
    await expect(firstCard.getByRole("heading", { level: 3 })).toHaveText(`${prefix} Alpha`);
    await expect(firstCard.getByRole("link", { name: /Gemiddeld 5,0 van 5 sterren uit 1 review/ })).toBeVisible();
    await expect(firstCard.getByText("Betrouwbaarheid 100%")).toBeVisible();
    // No reviews: "Eerste klus", never zero stars or 0%.
    const newcomer = cards.filter({ hasText: `${prefix} Nieuw` });
    await page.goto(q("&q=" + encodeURIComponent(`${prefix} Nieuw`)));
    await expect(newcomer.getByText("Eerste klus")).toBeVisible();
    await expect(newcomer.getByText("Betrouwbaarheid nog onbekend")).toBeVisible();
    await expect(newcomer.getByText("afstand onbekend")).toBeVisible();
    await expect(newcomer.getByText("Minder dan 1 jaar ervaring")).toBeVisible();
    await expect(newcomer.getByText(/0%|0,0/)).toHaveCount(0);
    // Unknown distance is excluded by a distance limit and sorted last.
    await page.goto(`/organisatie/kandidaten?q=${encodeURIComponent(`${prefix} Nieuw`)}&maxAfstand=25`);
    await expect(results.getByText("Geen kandidaten gevonden")).toBeVisible();
    await expect(results.getByRole("link", { name: "Filters wissen" }).last()).toBeVisible();
    await page.goto(q(`&sorteer=afstand&pagina=${pages}`));
    expect((await cardNames()).at(-1)).toBe(`${prefix} Nieuw`);
    await page.goto(q("&minBetrouwbaarheid=90"));
    expect(await cardNames()).toEqual([`${prefix} Alpha`]);

    // -----------------------------------------------------------------------
    // Availability for a specific job: proven, unknown, never guessed.
    // -----------------------------------------------------------------------
    await page.goto(q(`&job=${openJob}`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Kandidaten · ${prefix} Open`);
    const alphaCard = cards.filter({ hasText: `${prefix} Alpha` });
    await expect(alphaCard.getByText("Beschikbaar volgens rooster")).toBeVisible();
    await page.goto(q(`&job=${openJob}&beschikbaarheid=onbekend`));
    await expect(status).toContainText(`${total - 1} kandidaten gevonden`);
    await expect(cards.filter({ hasText: `${prefix} Alpha` })).toHaveCount(0);
    await expect(cards.first().getByText("Beschikbaarheid onbekend")).toBeVisible();
    await page.goto(q(`&job=${openJob}&beschikbaarheid=niet`));
    await expect(results.getByText("Geen kandidaten gevonden")).toBeVisible();
    await page.goto(q(`&job=${openJob}&beschikbaarheid=beschikbaar`));
    expect(await cardNames()).toEqual([`${prefix} Alpha`]);
    await expect(results.getByRole("combobox", { name: /Beschikbaarheid voor de opdracht/ })).toBeEnabled();

    // -----------------------------------------------------------------------
    // Invitation workflow: invite once, then shown as invited; no duplicates.
    // -----------------------------------------------------------------------
    await alphaCard.getByRole("button", { name: "Uitnodigen" }).click();
    // The success state can be replaced by the revalidated "Al uitgenodigd".
    await expect(alphaCard.getByText(/^(Uitgenodigd ✓|Al uitgenodigd)$/)).toBeVisible();
    await page.reload();
    await expect(alphaCard.getByText("Al uitgenodigd")).toBeVisible();
    await expect(alphaCard.getByRole("button", { name: "Uitnodigen" })).toHaveCount(0);
    const invitations = await admin.from("job_invitations").select("id").eq("job_id", openJob);
    expect(invitations.data).toHaveLength(1);
    const ownerClient = await signedInClient(ownerEmail);
    const duplicate = await ownerClient.rpc("invite_instructor", {
      p_job: openJob, p_instructor: alphaId, p_message: "",
    });
    expect(duplicate.error?.code).toBe("23505");
    await page.goto(q(`&relatie=uitgenodigd`));
    expect(await cardNames()).toEqual([`${prefix} Alpha`]);

    // -----------------------------------------------------------------------
    // Invalid and manipulated parameters.
    // -----------------------------------------------------------------------
    await page.goto(q("&sorteer=drop&minSterren=9&pagina=-3&sport=not-a-uuid&beschikbaarheid=beschikbaar&relatie=iedereen"));
    await expect(results.getByText("Ongeldige filterwaarden zijn genegeerd.")).toBeVisible();
    await expect(status).toContainText(`${total} kandidaten gevonden`);
    await page.goto(q(`&job=${otherJob}`));
    await expect(results.getByText(/Deze opdracht staat niet \(meer\) open/)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kandidaten");
    const foreign = await ownerClient.rpc("search_organization_candidates", { p_organization: orgIds[1] });
    expect(foreign.error?.code).toBe("42501");
    const foreignJob = await ownerClient.rpc("search_organization_candidates", {
      p_organization: orgIds[0], p_job: otherJob,
    });
    expect(foreignJob.error?.code).toBe("42501");
    const instructorClient = await signedInClient(alphaEmail);
    const asInstructor = await instructorClient.rpc("search_organization_candidates", {
      p_organization: orgIds[0],
    });
    expect(asInstructor.error?.code).toBe("42501");
    const anonymous = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    expect((await anonymous.rpc("search_organization_candidates", { p_organization: orgIds[0] })).error)
      .not.toBeNull();

    // -----------------------------------------------------------------------
    // Back navigation keeps the search (link and browser history).
    // -----------------------------------------------------------------------
    const searchUrl = q(`&sport=${fitness}&minErvaring=5&sorteer=ervaring&pagina=2`);
    await page.goto(searchUrl);
    const target = cards.first();
    const targetName = await target.getByRole("heading", { level: 3 }).innerText();
    await target.getByRole("link", { name: "Profiel bekijken" }).click();
    await expect(page.getByRole("heading", { level: 1, name: targetName })).toBeVisible();
    await page.getByRole("link", { name: "Terug naar kandidaten" }).click();
    await page.waitForURL(/pagina=2/);
    const backUrl = new URL(page.url());
    expect(backUrl.searchParams.get("minErvaring")).toBe("5");
    expect(backUrl.searchParams.get("sorteer")).toBe("ervaring");
    expect(backUrl.searchParams.get("sport")).toBe(fitness);
    await expect(cards.first().getByRole("heading", { level: 3 })).toHaveText(targetName);
    await target.getByRole("link", { name: "Profiel bekijken" }).click();
    await expect(page.getByRole("heading", { level: 1, name: targetName })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("searchbox")).toHaveValue(prefix);
    await expect(results.getByRole("combobox", { name: "Sorteren" })).toHaveValue("ervaring");

    // Relation quick filters, including an empty pool.
    await page.goto(q());
    await results.getByRole("link", { name: "Eerder mee samengewerkt", exact: true }).click();
    await page.waitForURL(/relatie=samengewerkt/);
    expect(await cardNames()).toEqual([`${prefix} Alpha`]);
    await expect(results.getByRole("link", { name: "Eerder mee samengewerkt", exact: true }))
      .toHaveAttribute("aria-current", "page");
    await results.getByRole("link", { name: "Mijn poule", exact: true }).click();
    await expect(results.getByText("Nog geen instructeurs opgeslagen.")).toBeVisible();

    // Mobile and desktop layout.
    await page.goto(q(`&job=${openJob}`));
    if (testInfo.project.name === "mobile") {
      await expect(results.getByText("Meer filters")).toBeVisible();
      await expect(results.getByRole("combobox", { name: "Minimale beoordeling" })).toBeHidden();
    }
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: testInfo.outputPath("candidates-job.png"), fullPage: true });
  } finally {
    for (const orgId of orgIds) {
      expect((await admin.from("organizations").delete().eq("id", orgId)).error).toBeNull();
    }
    await inBatches(userIds, 10, async (id) => {
      expect((await admin.auth.admin.deleteUser(id)).error).toBeNull();
    });
  }
});
