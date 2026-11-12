import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { dateInAmsterdam } from "@/lib/datetime/amsterdam";
import { addCalendarDays } from "@/lib/jobs/schedule";

test.skip(
  process.env.RUN_DEMO_E2E !== "true",
  "Isolated local Supabase is required",
);

test("volledig rooster, invalopdracht, wijzigingen en idempotente voorbeeldsync", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const owner = createClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const nonce = randomUUID();
  const email = `roster-${nonce}@example.test`;
  const password = `Roster-${nonce}-aA1!`;
  let userId: string | undefined;
  let orgId: string | undefined;
  try {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "organization", full_name: "Synthetic Planner" },
    });
    expect(created.error).toBeNull();
    userId = created.data.user!.id;
    expect(
      (
        await admin
          .from("profiles")
          .update({ onboarding_completed: true })
          .eq("id", userId)
      ).error,
    ).toBeNull();
    const org = await admin
      .from("organizations")
      .insert({
        name: `CI Rooster ${nonce}`,
        org_type: "gym",
        created_by: userId,
      })
      .select("id")
      .single();
    expect(org.error).toBeNull();
    orgId = org.data!.id;
    expect(
      (
        await admin
          .from("organization_members")
          .insert({
            organization_id: orgId,
            user_id: userId,
            member_role: "owner",
          })
      ).error,
    ).toBeNull();
    const city = await admin
      .from("cities")
      .select("id")
      .eq("name", "Utrecht")
      .single();
    expect(city.error).toBeNull();
    const locations = await admin
      .from("organization_locations")
      .insert([
        { organization_id: orgId, name: "Centrum", city_id: city.data!.id },
        { organization_id: orgId, name: "Noord", city_id: city.data!.id },
      ])
      .select("id,name");
    expect(locations.error).toBeNull();
    const centrum = locations.data!.find((item) => item.name === "Centrum")!.id;
    const noord = locations.data!.find((item) => item.name === "Noord")!.id;
    expect(
      (await owner.auth.signInWithPassword({ email, password })).error,
    ).toBeNull();
    await page.goto("/login");
    await page.getByLabel("E-mailadres", { exact: true }).fill(email);
    await page.getByLabel("Wachtwoord", { exact: true }).fill(password);
    await page
      .getByRole("main")
      .getByRole("button", { name: "Inloggen", exact: true })
      .click();
    await page.waitForURL("**/dashboard");
    await page.goto("/agenda");
    await page
      .getByRole("link", { name: "Les toevoegen", exact: true })
      .click();
    await page.getByLabel("Vestiging", { exact: true }).selectOption(centrum);
    await page
      .getByLabel("Sport", { exact: true })
      .selectOption({ label: "Fitness" });
    await page
      .getByLabel("Naam van de les", { exact: true })
      .fill("Pilot Circuittraining");
    await page.getByLabel("Soort les", { exact: true }).fill("Circuittraining");
    const tomorrow = addCalendarDays(dateInAmsterdam(new Date()), 1);
    await page.getByLabel("Datum", { exact: true }).fill(tomorrow);
    await page.getByLabel("Begintijd", { exact: true }).fill("09:00");
    await page.getByLabel("Eindtijd", { exact: true }).fill("10:00");
    await page
      .getByLabel("Instructeur (optioneel)", { exact: true })
      .fill("Trainer A");
    await page
      .getByLabel("Aantal wekelijkse lessen", { exact: true })
      .fill("2");
    await page
      .getByRole("button", { name: "Les opslaan", exact: true })
      .click();
    await page.waitForURL(/\/agenda\/lessen\/[0-9a-f-]+$/);
    const detailUrl = page.url();
    const lessonId = new URL(detailUrl).pathname.split("/").at(-1)!;
    await page.getByRole("main").getByRole("link", { name: "Agenda", exact: true }).click();
    const lessonLink = page.locator(`main a[href="/agenda/lessen/${lessonId}"]`);
    await expect(lessonLink).toContainText("Ingeplande les");
    await expect(lessonLink).toContainText("Trainer A");
    await page.goto(detailUrl);
    await page.getByLabel("Invalinstructeur nodig", { exact: true }).check();
    await page
      .getByRole("button", { name: "Les opslaan", exact: true })
      .click();
    await expect(page.locator('input[name="revision"]')).toHaveValue("2");
    await page.getByRole("main").getByRole("link", { name: "Agenda", exact: true }).click();
    await expect(
      page
        .getByRole("link")
        .filter({ hasText: "Pilot Circuittraining" })
        .first(),
    ).toContainText("Inval nodig · nog geen opdracht");
    await page.goto(detailUrl);
    await page
      .getByRole("link", { name: "Invalopdracht aanmaken", exact: true })
      .click();
    await expect(page.locator('input[name="startsOn"]')).toHaveValue(tomorrow);
    await expect(page.locator('input[name="startTime"]')).toHaveValue("09:00");
    await expect(page.getByLabel("Titel", { exact: true })).toHaveValue(
      "Pilot Circuittraining · inval",
    );
    await page.getByLabel("Uurtarief (€)", { exact: true }).fill("45");
    await page
      .getByRole("button", { name: "Opdracht plaatsen", exact: true })
      .click();
    await page.waitForURL(/\/organisatie\/opdrachten\/[0-9a-f-]+$/);
    const jobUrl = page.url();
    await page.goto(`/organisatie/opdrachten/nieuw?lesson=${lessonId}`);
    await expect(page).toHaveURL(jobUrl);
    const linked = await owner
      .from("lesson_replacement_jobs")
      .select("job_id")
      .eq("lesson_id", lessonId);
    expect(linked.error).toBeNull();
    expect(linked.data).toHaveLength(1);

    // Two simultaneous first requests for the second occurrence still create one job.
    const lessons = await owner
      .from("scheduled_lessons")
      .select("id,revision")
      .eq("organization_id", orgId)
      .order("starts_on");
    expect(lessons.error).toBeNull();
    expect(lessons.data).toHaveLength(2);
    const second = lessons.data!.find((item) => item.id !== lessonId)!;
    const args = {
      p_lesson: second.id,
      p_revision: second.revision,
      p_terms: {
        title: "Tweede circuitles inval",
        description: "Inval voor de tweede les.",
        contactName: "Synthetic Planner",
        payType: "hourly",
        payHourlyRateCents: 4500,
        qualificationIds: [],
      },
    };
    const simultaneous = await Promise.all([
      owner.rpc("create_lesson_replacement", args),
      owner.rpc("create_lesson_replacement", args),
    ]);
    for (const result of simultaneous) expect(result.error).toBeNull();
    expect(simultaneous[0].data).toBe(simultaneous[1].data);
    expect(
      (
        await owner
          .from("lesson_replacement_jobs")
          .select("job_id")
          .eq("lesson_id", second.id)
      ).data,
    ).toHaveLength(1);

    await page.goto(detailUrl);
    await page.getByLabel("Begintijd", { exact: true }).fill("09:15");
    await page
      .getByRole("button", { name: "Les opslaan", exact: true })
      .click();
    await expect(page.getByRole("main")).toContainText(
      "Het rooster is gewijzigd na plaatsing",
    );
    const published = await owner
      .from("jobs")
      .select("start_time")
      .eq("id", linked.data![0].job_id)
      .single();
    expect(published.error).toBeNull();
    expect(published.data!.start_time).toBe("09:00:00");
    await page.goto(`/agenda?lesson=${lessonId}`);
    const updatedLink = page.locator(`main a[href="/agenda/lessen/${lessonId}"]`);
    await expect(updatedLink).toContainText("09:15");
    await expect(updatedLink).toContainText("Rooster gewijzigd");
    const exported = await page.request.get("/agenda/export");
    expect(exported.status()).toBe(200);
    const calendar = await exported.text();
    expect(
      calendar.match(new RegExp(`UID:lesson-${lessonId}@sportmatch.nl`, "g")),
    ).toHaveLength(1);
    expect(calendar).toContain(
      `DTSTART;TZID=Europe/Amsterdam:${tomorrow.replaceAll("-", "")}T091500`,
    );
    await page.goto(`/agenda?location=${noord}`);
    await expect(
      page.getByRole("link").filter({ hasText: "Pilot Circuittraining" }),
    ).toHaveCount(0);

    await page.goto("/agenda/koppelingen");
    const source = page.getByRole("region", {
      name: "Voorbeeldrooster Centrum",
      exact: true,
    });
    await source
      .getByRole("button", { name: "Voorbeeldrooster tonen", exact: true })
      .click();
    await expect(source.getByRole("status")).toHaveText(
      "Voorbeeldrooster gesynchroniseerd; 12 lessen toegevoegd of gewijzigd.",
    );
    await expect(
      page.getByRole("region", { name: "Voorbeeldrooster Noord", exact: true }),
    ).toContainText("0 lessen");
    await source
      .getByRole("button", { name: "Opnieuw synchroniseren", exact: true })
      .click();
    await expect(source.getByRole("status")).toHaveText(
      "Voorbeeldrooster gesynchroniseerd; 0 lessen toegevoegd of gewijzigd.",
    );
    expect(
      (
        await owner
          .from("scheduled_lessons")
          .select("id")
          .eq("organization_id", orgId)
      ).data,
    ).toHaveLength(14);
    await page.goto("/agenda");
    await page
      .getByRole("link")
      .filter({ hasText: "Voorbeeld · Circuittraining" })
      .first()
      .click();
    await expect(page.getByRole("main")).toContainText("synthetische les");
    await expect(
      page.getByRole("link", { name: "Invalopdracht aanmaken", exact: true }),
    ).toHaveCount(0);
    await page.goto("/agenda/koppelingen");
    await source
      .getByRole("button", { name: "Voorbeeldrooster verbergen", exact: true })
      .click();
    await expect(source.getByRole("status")).toHaveText(
      "Voorbeeldrooster verborgen.",
    );
    await page.goto("/agenda");
    await expect(
      page.getByRole("link").filter({ hasText: "Voorbeeld ·" }),
    ).toHaveCount(0);
  } finally {
    await owner.auth.signOut();
    if (orgId)
      expect(
        (await admin.from("organizations").delete().eq("id", orgId)).error,
      ).toBeNull();
    if (userId)
      expect((await admin.auth.admin.deleteUser(userId)).error).toBeNull();
  }
});
