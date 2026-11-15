import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  devices,
  expect,
  test,
  type Locator,
  type Page,
} from "@playwright/test";
import { dateInAmsterdam } from "@/lib/datetime/amsterdam";
import { addCalendarDays } from "@/lib/jobs/schedule";

test.skip(
  process.env.RUN_DEMO_E2E !== "true",
  "Isolated local Supabase is required",
);

const instructorLabels = [
  "Duidelijke communicatie",
  "Goede organisatie",
  "Afspraken nagekomen",
  "Prettige samenwerking",
  "Goede faciliteiten",
];
const organizationLabels = [
  "Komt afspraken na",
  "Communiceert duidelijk",
  "Geeft kwalitatief goede lessen",
  "Is professioneel",
  "Is flexibel inzetbaar",
];

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/** Simulates a manipulated client request by adding raw form values. */
async function injectAttributes(form: Locator, values: string[]) {
  await form.evaluate((element, injected) => {
    for (const value of injected) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "attributes";
      input.value = value;
      input.dataset.injected = "true";
      element.appendChild(input);
    }
  }, values);
}

async function removeInjected(form: Locator) {
  await form.evaluate((element) => {
    element
      .querySelectorAll("[data-injected]")
      .forEach((input) => input.remove());
  });
}

test("kenmerken bij reviews: kiezen, valideren, dubbelblind vrijgeven en tonen", async ({
  page: school,
  browser,
}, testInfo) => {
  test.setTimeout(180_000);
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const nonce = randomUUID();
  const password = `Reviews-${nonce}-aA1!`;
  const ownerEmail = `review-attributes-owner-${nonce}@example.test`;
  const instructorEmail = `review-attributes-instructor-${nonce}@example.test`;
  const userIds: string[] = [];
  let orgId: string | undefined;
  const instructorContext = await browser.newContext({
    ...(testInfo.project.name === "mobile"
      ? devices["Pixel 7"]
      : devices["Desktop Chrome"]),
    baseURL: testInfo.project.use.baseURL,
  });
  const instructor = await instructorContext.newPage();
  const pastDay = addCalendarDays(dateInAmsterdam(new Date()), -2);
  const jobTitle = `Kenmerkenles ${nonce.slice(0, 8)}`;
  const legacyTitle = `Oude les ${nonce.slice(0, 8)}`;

  async function login(page: Page, email: string) {
    await page.goto("/login");
    await page.getByLabel("E-mailadres", { exact: true }).fill(email);
    await page.getByLabel("Wachtwoord", { exact: true }).fill(password);
    await page
      .getByRole("main")
      .getByRole("button", { name: "Inloggen", exact: true })
      .click();
    await page.waitForURL("**/dashboard");
  }

  try {
    // -----------------------------------------------------------------------
    // Synthetic fixtures: one gym, one instructor, a completed job to review
    // and an older, released review pair without attributes.
    // -----------------------------------------------------------------------
    for (const [email, role] of [
      [ownerEmail, "organization"],
      [instructorEmail, "instructor"],
    ]) {
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role, full_name: `Synthetic ${role}` },
      });
      expect(created.error).toBeNull();
      userIds.push(created.data.user!.id);
    }
    const [ownerId, instructorId] = userIds;
    expect(
      (
        await admin
          .from("profiles")
          .update({ onboarding_completed: true, phone: "" })
          .in("id", userIds)
      ).error,
    ).toBeNull();
    expect(
      (await admin.from("instructor_profiles").insert({ user_id: instructorId }))
        .error,
    ).toBeNull();
    const city = await admin
      .from("cities")
      .select("id")
      .eq("name", "Utrecht")
      .single();
    const sport = await admin
      .from("sports")
      .select("id")
      .eq("slug", "fitness")
      .single();
    expect(city.error).toBeNull();
    expect(sport.error).toBeNull();
    const org = await admin
      .from("organizations")
      .insert({
        name: `CI Reviews ${nonce}`,
        org_type: "gym",
        created_by: ownerId,
      })
      .select("id")
      .single();
    expect(org.error).toBeNull();
    orgId = org.data!.id;
    expect(
      (
        await admin.from("organization_members").insert({
          organization_id: orgId,
          user_id: ownerId,
          member_role: "owner",
        })
      ).error,
    ).toBeNull();
    const location = await admin
      .from("organization_locations")
      .insert({ organization_id: orgId, name: "Centrum", city_id: city.data!.id })
      .select("id")
      .single();
    expect(location.error).toBeNull();

    const jobIds = new Map<string, string>();
    for (const title of [jobTitle, legacyTitle]) {
      const job = await admin
        .from("jobs")
        .insert({
          organization_id: orgId,
          location_id: location.data!.id,
          created_by: ownerId,
          job_type: "one_time",
          sport_id: sport.data!.id,
          title,
          starts_on: pastDay,
          start_time: "09:00",
          end_time: "10:00",
          pay_type: "hourly",
          pay_hourly_rate_cents: 4500,
          status: "completed",
        })
        .select("id")
        .single();
      expect(job.error).toBeNull();
      const application = await admin
        .from("job_applications")
        .insert({
          job_id: job.data!.id,
          instructor_id: instructorId,
          status: "accepted",
        })
        .select("id")
        .single();
      expect(application.error).toBeNull();
      const confirmedAt = new Date().toISOString();
      expect(
        (
          await admin.from("job_confirmations").insert({
            job_id: job.data!.id,
            application_id: application.data!.id,
            instructor_id: instructorId,
            terms: {},
            organization_agreed_at: confirmedAt,
            organization_agreed_by: ownerId,
            instructor_agreed_at: confirmedAt,
            confirmed_at: confirmedAt,
          })
        ).error,
      ).toBeNull();
      jobIds.set(title, job.data!.id);
    }
    const jobId = jobIds.get(jobTitle)!;
    // Reviews from before this feature: no attributes column in the insert.
    expect(
      (
        await admin.from("reviews").insert([
          {
            job_id: jobIds.get(legacyTitle),
            reviewer_id: ownerId,
            reviewee_id: instructorId,
            side: "organization",
            rating: 3,
            comment: "Oude review zonder kenmerken.",
            released_at: new Date(Date.now() - 86_400_000).toISOString(),
          },
          {
            job_id: jobIds.get(legacyTitle),
            reviewer_id: instructorId,
            reviewee_id: ownerId,
            side: "instructor",
            rating: 5,
            comment: "Oude review zonder kenmerken.",
            released_at: new Date(Date.now() - 86_400_000).toISOString(),
          },
        ])
      ).error,
    ).toBeNull();

    // -----------------------------------------------------------------------
    // Instructor rates the gym.
    // -----------------------------------------------------------------------
    await login(instructor, instructorEmail);
    await instructor.goto(`/opdrachten/${jobId}`);
    await expect(
      instructor.getByRole("heading", { name: "Beoordeel de organisatie", exact: true }),
    ).toBeVisible();
    const instructorForm = instructor.locator("form").filter({
      has: instructor.getByRole("button", { name: "Beoordeling versturen" }),
    });
    const instructorGroup = instructorForm.getByRole("group", {
      name: "Kenmerken (optioneel)",
    });
    await expect(instructorGroup.getByRole("checkbox")).toHaveCount(5);
    for (const label of instructorLabels) {
      await expect(
        instructorGroup.getByRole("checkbox", { name: label, exact: true }),
      ).not.toBeChecked();
    }
    for (const label of organizationLabels) {
      await expect(instructorGroup.getByText(label, { exact: true })).toHaveCount(0);
    }
    // Stars remain required.
    await expect(
      instructorForm.getByRole("button", { name: "Beoordeling versturen" }),
    ).toBeDisabled();
    await instructorForm.getByRole("button", { name: "4 sterren", exact: true }).click();
    await expect(instructorForm.getByText("4 van 5 · Goed")).toBeVisible();

    for (const label of [
      "Goede faciliteiten",
      "Duidelijke communicatie",
      "Prettige samenwerking",
    ]) {
      await instructorGroup.getByText(label, { exact: true }).click();
      await expect(
        instructorGroup.getByRole("checkbox", { name: label, exact: true }),
      ).toBeChecked();
    }
    await expect(instructorForm.getByText("3 van 3 gekozen")).toBeVisible();
    // A fourth attribute cannot be selected; deselecting frees a slot.
    await expect(
      instructorGroup.getByRole("checkbox", { name: "Goede organisatie", exact: true }),
    ).toBeDisabled();
    await instructorGroup.getByText("Prettige samenwerking", { exact: true }).click();
    await expect(
      instructorGroup.getByRole("checkbox", { name: "Goede organisatie", exact: true }),
    ).toBeEnabled();
    await expect(instructorForm.getByText("2 van 3 gekozen")).toBeVisible();
    await instructor.screenshot({
      path: testInfo.outputPath("review-form-instructor.png"),
      fullPage: true,
    });
    await expectNoHorizontalScroll(instructor);

    // Manipulated requests are refused by the server action and database.
    const submit = instructorForm.getByRole("button", { name: "Beoordeling versturen" });
    for (const [injected, message] of [
      [["agreements_kept", "well_organized"], "Kies maximaal drie kenmerken."],
      [["good_facilities"], "Kies ieder kenmerk maar één keer."],
      [["hacked_value"], "Een gekozen kenmerk is onbekend."],
      [["professional"], "Een gekozen kenmerk hoort niet bij deze beoordeling."],
    ] as const) {
      await injectAttributes(instructorForm, [...injected]);
      await submit.click();
      await expect(instructorForm.getByText(message)).toBeVisible();
      // The refused request keeps the user's own choices intact.
      await expect(
        instructorGroup.getByRole("checkbox", { name: "Goede faciliteiten", exact: true }),
      ).toBeChecked();
      await expect(instructorForm.getByText("2 van 3 gekozen")).toBeVisible();
      await removeInjected(instructorForm);
    }
    expect(
      (await admin.from("reviews").select("id").eq("job_id", jobId)).data,
    ).toHaveLength(0);

    // Valid submission with three attributes and a comment.
    await instructorGroup.getByText("Prettige samenwerking", { exact: true }).click();
    for (const label of [
      "Goede faciliteiten",
      "Duidelijke communicatie",
      "Prettige samenwerking",
    ]) {
      await expect(
        instructorGroup.getByRole("checkbox", { name: label, exact: true }),
      ).toBeChecked();
    }
    await instructorForm
      .getByLabel("Toelichting (optioneel)")
      .fill("Heldere briefing en een goed verzorgde zaal.");
    await submit.click();
    await expect(
      instructor.getByRole("heading", { name: "Beoordeel de organisatie", exact: true }),
    ).toHaveCount(0);
    const instructorReview = await admin
      .from("reviews")
      .select("attributes,released_at,rating,comment")
      .eq("job_id", jobId)
      .eq("reviewer_id", instructorId)
      .single();
    expect(instructorReview.error).toBeNull();
    expect(instructorReview.data).toMatchObject({
      attributes: ["clear_communication", "pleasant_collaboration", "good_facilities"],
      released_at: null,
      rating: 4,
      comment: "Heldere briefing en een goed verzorgde zaal.",
    });

    // Given, not yet released: visible to the author with a waiting badge.
    await instructor.goto("/reviews?view=given");
    const pendingGiven = instructor
      .getByRole("main")
      .locator("article")
      .filter({ hasText: jobTitle });
    await expect(pendingGiven.getByText("Wacht op tegenpartij")).toBeVisible();
    await expect(
      pendingGiven.getByRole("list", { name: "Kenmerken" }).getByRole("listitem"),
    ).toHaveText(["Duidelijke communicatie", "Prettige samenwerking", "Goede faciliteiten"]);

    // -----------------------------------------------------------------------
    // Double blind: the gym cannot see the instructor's review yet.
    // -----------------------------------------------------------------------
    await login(school, ownerEmail);
    await school.goto("/organisatie/reviews");
    await expect(
      school.getByRole("main").locator("article").filter({ hasText: jobTitle }),
    ).toHaveCount(0);
    await expect(school.getByRole("main").getByText("Prettige samenwerking")).toHaveCount(0);

    // -----------------------------------------------------------------------
    // Gym rates the instructor, with the existing complaint option.
    // -----------------------------------------------------------------------
    await school.goto(`/organisatie/opdrachten/${jobId}`);
    await expect(
      school.getByRole("heading", { name: "Beoordeel de instructeur", exact: true }),
    ).toBeVisible();
    const schoolForm = school.locator("form").filter({
      has: school.getByRole("button", { name: "Beoordeling versturen" }),
    });
    const schoolGroup = schoolForm.getByRole("group", { name: "Kenmerken (optioneel)" });
    await expect(schoolGroup.getByRole("checkbox")).toHaveCount(5);
    for (const label of organizationLabels) {
      await expect(
        schoolGroup.getByRole("checkbox", { name: label, exact: true }),
      ).toBeVisible();
    }
    for (const label of instructorLabels) {
      await expect(schoolGroup.getByText(label, { exact: true })).toHaveCount(0);
    }
    await schoolForm.getByRole("button", { name: "2 sterren", exact: true }).click();
    await schoolGroup.getByText("Communiceert duidelijk", { exact: true }).click();
    await schoolForm.getByLabel("Ik wil dit ook melden bij SportMatch").check();
    await schoolForm
      .getByLabel("Toelichting voor SportMatch")
      .fill("De les begon later dan afgesproken, graag apart bekijken.");
    await school.screenshot({
      path: testInfo.outputPath("review-form-school.png"),
      fullPage: true,
    });
    await expectNoHorizontalScroll(school);
    await schoolForm.getByRole("button", { name: "Beoordeling versturen" }).click();
    await expect(
      school.getByRole("heading", { name: "Beoordeel de instructeur", exact: true }),
    ).toHaveCount(0);

    const reviews = await admin
      .from("reviews")
      .select("id,side,attributes,released_at")
      .eq("job_id", jobId);
    expect(reviews.error).toBeNull();
    expect(reviews.data).toHaveLength(2);
    expect(reviews.data!.every((review) => review.released_at)).toBe(true);
    const schoolReview = reviews.data!.find((review) => review.side === "organization")!;
    expect(schoolReview.attributes).toEqual(["communicates_clearly"]);
    const complaint = await admin
      .from("complaints")
      .select("review_id,category")
      .eq("job_id", jobId)
      .single();
    expect(complaint.error).toBeNull();
    expect(complaint.data).toEqual({ review_id: schoolReview.id, category: "conduct" });

    // -----------------------------------------------------------------------
    // Display on every review page, next to reviews without attributes.
    // -----------------------------------------------------------------------
    // Gym: received (from instructor) and given.
    await school.goto("/organisatie/reviews");
    let main = school.getByRole("main");
    await expect(main.locator("article")).toHaveCount(2);
    await expect(main.getByRole("list", { name: "Kenmerken" })).toHaveCount(1);
    await expect(
      main
        .locator("article")
        .filter({ hasText: jobTitle })
        .getByRole("list", { name: "Kenmerken" })
        .getByRole("listitem"),
    ).toHaveText(["Duidelijke communicatie", "Prettige samenwerking", "Goede faciliteiten"]);
    await expect(main.getByText("Oude review zonder kenmerken.")).toBeVisible();
    await expectNoHorizontalScroll(school);
    await school.screenshot({
      path: testInfo.outputPath("reviews-school-received.png"),
      fullPage: true,
    });
    await school.goto("/organisatie/reviews?view=given");
    main = school.getByRole("main");
    await expect(
      main
        .locator("article")
        .filter({ hasText: jobTitle })
        .getByRole("list", { name: "Kenmerken" }),
    ).toHaveText("Communiceert duidelijk");
    await expect(main.getByText("Wacht op tegenpartij")).toHaveCount(0);

    // Gym: public instructor profile.
    await school.goto(`/organisatie/kandidaten/${instructorId}`);
    const profileReviews = school.locator("#reviews");
    await expect(profileReviews.locator("article")).toHaveCount(2);
    await expect(profileReviews.getByRole("list", { name: "Kenmerken" })).toHaveCount(1);
    await expect(
      profileReviews.getByRole("list", { name: "Kenmerken" }),
    ).toHaveText("Communiceert duidelijk");
    // Existing star filter and sorting still apply.
    await school.goto(`/organisatie/kandidaten/${instructorId}?stars=3#reviews`);
    await expect(profileReviews.locator("article")).toHaveCount(1);
    await expect(profileReviews.getByRole("list", { name: "Kenmerken" })).toHaveCount(0);
    await expectNoHorizontalScroll(school);

    // Gym: released reviews on the job page.
    await school.goto(`/organisatie/opdrachten/${jobId}`);
    await expect(
      school.getByRole("list", { name: "Kenmerken" }).filter({ hasText: "Goede faciliteiten" }),
    ).toBeVisible();

    // Instructor: received (from gym) and given.
    await instructor.goto("/reviews");
    main = instructor.getByRole("main");
    await expect(main.locator("article")).toHaveCount(2);
    await expect(
      main
        .locator("article")
        .filter({ hasText: jobTitle })
        .getByRole("list", { name: "Kenmerken" }),
    ).toHaveText("Communiceert duidelijk");
    await expect(
      main.locator("article").filter({ hasText: legacyTitle }).getByRole("list"),
    ).toHaveCount(0);
    await expectNoHorizontalScroll(instructor);
    await instructor.screenshot({
      path: testInfo.outputPath("reviews-instructor-received.png"),
      fullPage: true,
    });
    await instructor.goto("/reviews?view=given");
    main = instructor.getByRole("main");
    await expect(main.getByText("Wacht op tegenpartij")).toHaveCount(0);
    await expect(main.getByRole("list", { name: "Kenmerken" })).toHaveCount(1);

    // Instructor: public gym review page, with filter and sort.
    await instructor.goto(`/organisaties/${orgId}/reviews`);
    main = instructor.getByRole("main");
    await expect(main.locator("article")).toHaveCount(2);
    await expect(main.getByRole("list", { name: "Kenmerken" })).toHaveCount(1);
    await instructor.goto(`/organisaties/${orgId}/reviews?sort=lowest`);
    await expect(
      main.locator("article").first().getByRole("list", { name: "Kenmerken" }),
    ).toHaveText(/Duidelijke communicatie/);
    await instructor.goto(`/organisaties/${orgId}/reviews?stars=5`);
    await expect(main.locator("article")).toHaveCount(1);
    await expect(main.getByRole("list", { name: "Kenmerken" })).toHaveCount(0);
    await expectNoHorizontalScroll(instructor);

    // Instructor: released reviews on the job page.
    await instructor.goto(`/opdrachten/${jobId}`);
    await expect(
      instructor.getByRole("list", { name: "Kenmerken" }).filter({ hasText: "Communiceert duidelijk" }),
    ).toBeVisible();
  } finally {
    await instructorContext.close();
    await school.goto("/");
    if (orgId)
      expect(
        (await admin.from("organizations").delete().eq("id", orgId)).error,
      ).toBeNull();
    for (const id of userIds)
      expect((await admin.auth.admin.deleteUser(id)).error).toBeNull();
  }
});
