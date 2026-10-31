import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { devices, expect, test, type Page } from "@playwright/test";
import { dateInAmsterdam } from "@/lib/datetime/amsterdam";
import { addCalendarDays } from "@/lib/jobs/schedule";

test.skip(
  process.env.RUN_DEMO_E2E !== "true",
  "Isolated local Supabase is required",
);

test("status, urgentie, onderhandelen en contactvelden blijven consistent", async ({
  page: school,
  browser,
}, testInfo) => {
  test.setTimeout(150_000);
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const nonce = randomUUID();
  const password = `Hardening-${nonce}-aA1!`;
  const ownerEmail = `hardening-owner-${nonce}@example.test`;
  const instructorEmail = `hardening-instructor-${nonce}@example.test`;
  const userIds: string[] = [];
  let orgId: string | undefined;
  const instructorContext = await browser.newContext({
    ...(testInfo.project.name === "mobile"
      ? devices["Pixel 7"]
      : devices["Desktop Chrome"]),
    baseURL: testInfo.project.use.baseURL,
  });
  const instructor = await instructorContext.newPage();
  const today = dateInAmsterdam(new Date());
  const tomorrow = addCalendarDays(today, 1);
  const stamp = new Date().toISOString();
  const jobs = new Map<string, string>();
  const applications = new Map<string, string>();

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
    expect(
      (
        await admin
          .from("profiles")
          .update({ onboarding_completed: true, phone: "" })
          .in("id", userIds)
      ).error,
    ).toBeNull();
    expect(
      (await admin.from("instructor_profiles").insert({ user_id: userIds[1] }))
        .error,
    ).toBeNull();
    expect(
      (
        await admin.from("document_uploads").insert({
          user_id: userIds[1],
          doc_type: "vog",
          storage_path: `tests/${nonce}/synthetic.pdf`,
          original_filename: "synthetic.pdf",
          status: "approved",
          expires_at: "2099-01-01",
        })
      ).error,
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
        name: `CI Hardening ${nonce}`,
        org_type: "gym",
        created_by: userIds[0],
      })
      .select("id")
      .single();
    expect(org.error).toBeNull();
    orgId = org.data!.id;
    expect(
      (
        await admin.from("organization_members").insert({
          organization_id: orgId,
          user_id: userIds[0],
          member_role: "owner",
        })
      ).error,
    ).toBeNull();
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

    for (const label of [
      "Partial",
      "Planned",
      "Fixed",
      "Negotiable",
      "Recurring",
      "Covered",
      "Closed",
      "Other location",
    ]) {
      const job = await admin
        .from("jobs")
        .insert({
          organization_id: orgId,
          location_id: label === "Other location" ? noord : centrum,
          created_by: userIds[0],
          job_type: label === "Recurring" ? "recurring" : "one_time",
          sport_id: sport.data!.id,
          title: label,
          starts_on:
            label === "Recurring" ? addCalendarDays(tomorrow, -21) : tomorrow,
          start_time:
            label === "Recurring"
              ? "08:00"
              : label === "Covered"
                ? "13:00"
                : "09:00",
          end_time: label === "Covered" ? "14:00" : "12:00",
          pay_type: "hourly",
          pay_hourly_rate_cents: 4500,
          pay_is_negotiable: label !== "Fixed",
          status:
            label === "Covered"
              ? "confirmed"
              : label === "Closed"
                ? "closed"
                : "open",
          partial_block_allowed: true,
        })
        .select("id")
        .single();
      expect(job.error).toBeNull();
      jobs.set(label, job.data!.id);
      if (label === "Recurring" || label === "Other location") continue;
      const app = await admin
        .from("job_applications")
        .insert({
          job_id: job.data!.id,
          instructor_id: userIds[1],
          status: label === "Covered" ? "accepted" : "pending",
        })
        .select("id")
        .single();
      expect(app.error).toBeNull();
      applications.set(label, app.data!.id);
    }
    expect(
      (
        await admin.from("job_recurrence_rules").insert({
          job_id: jobs.get("Recurring"),
          interval_weeks: 1,
          occurrence_count: 8,
        })
      ).error,
    ).toBeNull();
    for (const label of ["Partial", "Planned"]) {
      const segments = await admin
        .from("job_segments")
        .insert(
          [1, 2, 3].map((position) => ({
            job_id: jobs.get(label),
            position,
            start_time: `${position + 8}:00`,
            end_time: `${position + 9}:00`,
            custom_lesson_type: `Les ${position}`,
          })),
        )
        .select("id,position");
      expect(segments.error).toBeNull();
      const selected =
        label === "Partial"
          ? segments.data!.filter((s) => s.position < 3)
          : segments.data!.filter((s) => s.position === 1);
      expect(
        (
          await admin.from("job_application_segments").insert(
            segments.data!.map((s) => ({
              application_id: applications.get(label),
              segment_id: s.id,
            })),
          )
        ).error,
      ).toBeNull();
      expect(
        (
          await admin.from("job_segment_confirmations").insert(
            selected.map((s) => ({
              job_id: jobs.get(label),
              segment_id: s.id,
              application_id: applications.get(label),
              instructor_id: userIds[1],
              organization_agreed_by: userIds[0],
              organization_agreed_at: stamp,
              confirmed_at:
                label === "Partial" && s.position === 1 ? stamp : null,
            })),
          )
        ).error,
      ).toBeNull();
    }
    expect(
      (
        await admin.from("job_confirmations").insert({
          job_id: jobs.get("Covered"),
          application_id: applications.get("Covered"),
          instructor_id: userIds[1],
          organization_agreed_at: stamp,
          confirmed_at: stamp,
        })
      ).error,
    ).toBeNull();

    expect((await admin.from("job_confirmations").insert({ job_id: jobs.get("Closed"), application_id: applications.get("Closed"),
      instructor_id: userIds[1], organization_agreed_at: stamp })).error).toBeNull();
    await login(school, ownerEmail);
    await school.goto("/organisatie/opdrachten");
    for (const [label, state] of [
      ["Partial", "Gedeeltelijk bevestigd"],
      ["Planned", "Wacht op bevestiging"],
      ["Covered", "Bevestigd"],
      ["Closed", "Gesloten"],
    ]) {
      const row = school.locator("li").filter({
        has: school.getByRole("link", { name: label, exact: true }),
      });
      await expect(row.getByText(state, { exact: true }).first()).toBeVisible();
    }
    const exported = await school.request.get(`/agenda/export?location=${centrum}`);
    expect(exported.ok()).toBe(true);
    const closedEvent = (await exported.text()).split("BEGIN:VEVENT").find((event) => event.includes("Closed"));
    expect(closedEvent).toContain("STATUS:CANCELLED");
    await school.goto(`/dashboard?location=${centrum}`);
    const urgent = school.locator("section").filter({
      has: school.getByRole("heading", { name: "Urgentie", exact: true }),
    });
    await expect(urgent.getByText("Recurring", { exact: true })).toBeVisible();
    await expect(urgent.getByText("Partial", { exact: true })).toBeVisible();
    await expect(urgent.getByText("Covered", { exact: true })).toHaveCount(0);
    await expect(
      urgent.getByText("Other location", { exact: true }),
    ).toHaveCount(0);
    await school.goto(`/organisatie/opdrachten/${jobs.get("Partial")}`);
    await expect(
      school.getByText("Gedeeltelijk bevestigd", { exact: true }),
    ).toBeVisible();
    await expect(school.locator("a button, button a")).toHaveCount(0);
    await school.goto(`/organisatie/opdrachten/${jobs.get("Fixed")}`);
    await expect(
      school.getByText("Tegenvoorstel doen", { exact: true }),
    ).toHaveCount(0);
    await school.goto(`/organisatie/opdrachten/${jobs.get("Covered")}`);
    const contact = school
      .getByRole("heading", { name: "Bevestigde instructeur", exact: true })
      .locator("..")
      .locator("..");
    await expect(contact).toContainText(instructorEmail);
    await expect(contact.locator("svg.lucide-phone")).toHaveCount(0);

    await login(instructor, instructorEmail);
    await expect(
      instructor
        .getByRole("main")
        .getByText(/Partial/)
        .first(),
    ).toBeVisible();
    await instructor.goto(`/opdrachten/${jobs.get("Covered")}`);
    const organizationContact = instructor
      .getByRole("heading", { name: "Opdracht bevestigd", exact: true })
      .locator("..")
      .locator("..");
    await expect(organizationContact).toBeVisible();
    await expect(
      organizationContact.locator("svg.lucide-phone, svg.lucide-mail"),
    ).toHaveCount(0);
    await expect(
      organizationContact.locator("p").filter({ hasText: /^$/ }),
    ).toHaveCount(0);
    await instructor.goto(`/opdrachten/${jobs.get("Fixed")}`);
    await expect(
      instructor.getByRole("button", {
        name: "Tegenvoorstel doen",
        exact: true,
      }),
    ).toHaveCount(0);
    await instructor.goto(`/opdrachten/${jobs.get("Partial")}`);
    await expect(
      instructor.getByRole("button", {
        name: "Tegenvoorstel doen",
        exact: true,
      }),
    ).toHaveCount(0);
    await instructor.goto(`/opdrachten/${jobs.get("Negotiable")}`);
    await instructor.getByLabel("Bedrag (€)").fill("55");
    await instructor
      .getByRole("button", { name: "Tegenvoorstel doen", exact: true })
      .click();
    await expect(
      instructor.getByText("Tegenvoorstel verstuurd.", { exact: true }),
    ).toBeVisible();
    await expect
      .poll(
        async () =>
          (
            await admin
              .from("job_counteroffers")
              .select("id", { count: "exact", head: true })
              .eq("application_id", applications.get("Negotiable")!)
          ).count,
      )
      .toBe(1);
    await instructor.goto("/mijn-reacties");
    const plannedResponse = instructor.getByRole("link", { name: "Planned", exact: true }).locator("..").locator("..");
    await plannedResponse.getByRole("button", { name: "Intrekken", exact: true }).click();
    await expect(plannedResponse.getByText("Ingetrokken", { exact: true })).toBeVisible();
    await school.goto(`/organisatie/opdrachten/${jobs.get("Planned")}`);
    await expect(school.getByText("Nog iemand zoeken", { exact: true })).toBeVisible();
    await expect(school.getByText("Wacht op bevestiging", { exact: true })).toHaveCount(0);
    await instructor.screenshot({
      path: testInfo.outputPath("instructor-negotiation.png"),
      fullPage: true,
    });
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
