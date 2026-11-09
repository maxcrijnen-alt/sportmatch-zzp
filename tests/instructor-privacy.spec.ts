import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { dateInAmsterdam } from "@/lib/datetime/amsterdam";
import { addCalendarDays } from "@/lib/jobs/schedule";
import type { InstructorCandidateProfile, Profile } from "@/types/database";

test.skip(process.env.RUN_DEMO_E2E !== "true", "Isolated local Supabase is required");

test("private administratie blijft afgeschermd terwijl profiel en kandidaten werken", async ({ page }) => {
  test.setTimeout(150_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, options);
  const anonymous = createClient(url, key, options);
  const nonce = randomUUID();
  const password = `Privacy-${nonce}-aA1!`;
  const actors = ["a", "b", "school", "admin", "demo-a", "demo-b", "demo-school"] as const;
  type Actor = typeof actors[number];
  const ids = {} as Record<Actor, string>;
  const clients = {} as Record<Actor, SupabaseClient>;
  const emails = {} as Record<Actor, string>;
  const orgIds: string[] = [];
  const sessionIds: string[] = [];
  const originalBirthDate = "1990-03-14";
  const vat = `SYNTHETIC-VAT-${nonce}`;
  let avatarPath: string | undefined;

  async function login(actor: Actor) {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByLabel("E-mailadres", { exact: true }).fill(emails[actor]);
    await page.getByLabel("Wachtwoord", { exact: true }).fill(password);
    await page.getByRole("main").getByRole("button", { name: "Inloggen", exact: true }).click();
    await page.waitForURL(actor === "admin" ? "**/admin" : "**/dashboard");
  }

  async function noPrivateRead(client: SupabaseClient) {
    for (const column of ["birth_date", "kvk_number", "btw_number", "*"]) {
      const result = await client.from("instructor_profiles").select(column).eq("user_id", ids.a);
      expect(result.error?.code).toBe("42501");
      expect(result.data).toBeNull();
    }
    const embedded = await client.from("profiles")
      .select("id,instructor_profiles(birth_date,kvk_number,btw_number)").eq("id", ids.a);
    expect(embedded.error?.code).toBe("42501");
    const filtered = await client.from("instructor_profiles")
      .select("user_id").eq("birth_date", originalBirthDate);
    expect(filtered.error?.code).toBe("42501");
  }

  try {
    for (const actor of actors) {
      emails[actor] = `privacy-${actor}-${nonce}@example.test`;
      const created = await admin.auth.admin.createUser({
        email: emails[actor], password, email_confirm: true,
        user_metadata: { role: actor.includes("school") ? "organization" : "instructor", full_name: `CI Privacy ${actor}` },
      });
      expect(created.error).toBeNull();
      ids[actor] = created.data.user!.id;
    }
    const city = await admin.from("cities").select("id").eq("name", "Utrecht").single();
    const sport = await admin.from("sports").select("id").eq("slug", "fitness").single();
    expect(city.error).toBeNull();
    expect(sport.error).toBeNull();
    expect((await admin.from("profiles").update({ onboarding_completed: true, city_id: city.data!.id })
      .in("id", Object.values(ids))).error).toBeNull();
    expect((await admin.from("profiles").update({ role: "admin" }).eq("id", ids.admin)).error).toBeNull();
    for (const pair of [["demo-a", "demo-school"], ["demo-b"]] as Actor[][]) {
      const session = await admin.from("demo_sessions").insert({}).select("id").single();
      expect(session.error).toBeNull();
      sessionIds.push(session.data!.id);
      expect((await admin.from("profiles").update({ demo_session_id: session.data!.id })
        .in("id", pair.map(actor => ids[actor]))).error).toBeNull();
    }
    for (const actor of ["a", "b", "demo-a", "demo-b"] as const) {
      expect((await admin.from("instructor_profiles").insert({
        user_id: ids[actor], birth_date: originalBirthDate, kvk_number: "12345678", btw_number: vat,
        years_experience: 5, work_experience: "Vijf jaar groepslessen. Synthetische privacyfixture.",
        hourly_rate_cents: 4500, travel_distance_km: 30,
      })).error).toBeNull();
    }
    for (const actor of ["school", "demo-school"] as const) {
      const org = await admin.from("organizations").insert({
        name: `CI Privacy ${actor} ${nonce}`, org_type: "gym", created_by: ids[actor],
        demo_session_id: actor === "school" ? null : sessionIds[0],
      }).select("id").single();
      expect(org.error).toBeNull();
      orgIds.push(org.data!.id);
      expect((await admin.from("organization_members").insert({
        organization_id: org.data!.id, user_id: ids[actor], member_role: "owner",
      })).error).toBeNull();
    }
    const location = await admin.from("organization_locations").insert({
      organization_id: orgIds[0], name: "Privacy Centrum", city_id: city.data!.id,
    }).select("id").single();
    expect(location.error).toBeNull();
    expect((await admin.from("instructor_statuses").insert({ user_id: ids.a, status: "zzp" })).error).toBeNull();
    expect((await admin.from("instructor_sports").insert({ user_id: ids.a, sport_id: sport.data!.id })).error).toBeNull();
    expect((await admin.from("document_uploads").insert({
      user_id: ids.a, doc_type: "vog", storage_path: `tests/${nonce}/synthetic.pdf`,
      original_filename: "synthetic.pdf", status: "approved", expires_at: "2099-01-01",
    })).error).toBeNull();
    const job = await admin.from("jobs").insert({
      organization_id: orgIds[0], location_id: location.data!.id, created_by: ids.school,
      job_type: "one_time", sport_id: sport.data!.id, title: `Privacytraining ${nonce}`,
      starts_on: addCalendarDays(dateInAmsterdam(new Date()), 1), start_time: "10:00", end_time: "11:00",
      pay_type: "hourly", pay_hourly_rate_cents: 4500,
    }).select("id").single();
    expect(job.error).toBeNull();

    for (const actor of actors) {
      clients[actor] = createClient(url, key, options);
      expect((await clients[actor].auth.signInWithPassword({ email: emails[actor], password })).error).toBeNull();
    }
    // Real Data API requests; service_role is used only for synthetic fixture setup.
    for (const client of [anonymous, ...Object.values(clients)]) await noPrivateRead(client);
    expect((await anonymous.rpc("get_instructor_private_profile", { p_instructor: ids.a })).error?.code).toBe("42501");
    const own = await clients.a.rpc("get_instructor_private_profile", { p_instructor: ids.a }).single();
    expect(own.error).toBeNull();
    expect(own.data).toMatchObject({ birth_date: originalBirthDate, kvk_number: "12345678", btw_number: vat });
    for (const actor of ["b", "school", "demo-a", "demo-school"] as const) {
      const denied = await clients[actor].rpc("get_instructor_private_profile", { p_instructor: ids.a });
      expect(denied.error).toBeNull();
      expect(denied.data).toEqual([]);
    }
    const administrative = await clients.admin.rpc("get_instructor_private_profile", { p_instructor: ids.a }).single();
    expect(administrative.error).toBeNull();
    expect(administrative.data).toMatchObject({ birth_date: originalBirthDate, kvk_number: "12345678", btw_number: vat });
    const otherInstructor = await clients.b.rpc("get_instructor_candidate_profile", { p_instructor: ids.a });
    expect(otherInstructor.error).toBeNull();
    expect(otherInstructor.data).toEqual([]);
    const safeColumns = await clients.school.from("instructor_profiles")
      .select("user_id,years_experience,hourly_rate_cents").eq("user_id", ids.a).single();
    expect(safeColumns.error).toBeNull();
    expect(safeColumns.data).toMatchObject({ user_id: ids.a, years_experience: 5, hourly_rate_cents: 4500 });
    for (const [actor, target] of [
      ["a", "demo-a"], ["demo-a", "a"], ["demo-a", "demo-b"], ["demo-school", "demo-b"],
    ] as [Actor, Actor][]) {
      const safe = await clients[actor].from("instructor_profiles").select("user_id").eq("user_id", ids[target]);
      expect(safe.error).toBeNull();
      expect(safe.data).toEqual([]);
      const candidate = await clients[actor].rpc("get_instructor_candidate_profile", { p_instructor: ids[target] });
      expect(candidate.error).toBeNull();
      expect(candidate.data).toEqual([]);
    }
    const demoCandidate = await clients["demo-school"].rpc("get_instructor_candidate_profile", { p_instructor: ids["demo-a"] }).single();
    expect(demoCandidate.error).toBeNull();
    const candidate = await clients.school.rpc("get_instructor_candidate_profile", { p_instructor: ids.a })
      .returns<InstructorCandidateProfile[]>().single();
    expect(candidate.error).toBeNull();
    expect(candidate.data).not.toBeNull();
    expect(Object.keys(candidate.data!).sort()).toEqual([
      "age", "hourly_rate_cents", "travel_distance_km", "user_id", "work_experience", "years_experience",
    ]);
    const today = dateInAmsterdam(new Date());
    const expectedAge = Number(today.slice(0, 4)) - 1990 - (today.slice(5) < "03-14" ? 1 : 0);
    expect(candidate.data!.age).toBe(expectedAge);

    await login("a");
    await page.goto("/profiel");
    await expect(page.getByLabel("KvK-nummer", { exact: true })).toHaveValue("12345678");
    await page.getByLabel("KvK-nummer", { exact: true }).fill("87654321");
    await page.getByRole("button", { name: "Instructeursprofiel opslaan", exact: true }).click();
    await expect(page.getByText("Instructeursgegevens opgeslagen.", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("KvK-nummer", { exact: true })).toHaveValue("87654321");
    const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1sAAAAASUVORK5CYII=", "base64");
    await page.locator('input[type="file"]').setInputFiles({ name: "synthetic-avatar.png", mimeType: "image/png", buffer: pixel });
    await expect.poll(async () => {
      const result = await clients.a.rpc("get_my_profile").returns<Profile[]>().single();
      return result.data?.avatar_url;
    }).toContain("/avatars/");
    const avatar = await clients.a.rpc("get_my_profile").returns<Profile[]>().single();
    avatarPath = new URL(avatar.data!.avatar_url!).pathname.split("/avatars/")[1];

    await login("school");
    await page.goto(`/organisatie/kandidaten?job=${job.data!.id}`);
    await page.getByRole("link", { name: "CI Privacy a", exact: true }).click();
    await expect(page.getByRole("heading", { name: "CI Privacy a", exact: true })).toBeVisible();
    await expect(page.getByText(`${expectedAge} jaar`, { exact: true })).toBeVisible();
    await expect(page.getByText("VOG goedgekeurd", { exact: true })).toBeVisible();
    await expect(page.getByText("Vijf jaar groepslessen. Synthetische privacyfixture.", { exact: true })).toBeVisible();
    await expect(page.getByRole("img", { name: "CI Privacy a", exact: true })).toBeVisible();
    await expect.poll(() => page.getByRole("img", { name: "CI Privacy a", exact: true })
      .evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    const html = await page.content();
    for (const secret of [originalBirthDate, "87654321", vat]) expect(html).not.toContain(secret);
    expect((await clients.school.rpc("invite_instructor", { p_job: job.data!.id, p_instructor: ids.a, p_message: "Synthetic privacy invitation" })).error).toBeNull();
    const count = await clients.admin.from("instructor_profiles").select("user_id", { count: "exact", head: true });
    expect(count.error).toBeNull();
    expect(count.count).toBeGreaterThanOrEqual(4);
    await login("admin");
    await expect(page.getByRole("heading", { name: "Adminoverzicht", exact: true })).toBeVisible();
  } finally {
    if (avatarPath) await admin.storage.from("avatars").remove([avatarPath]);
    for (const orgId of orgIds) await admin.from("organizations").delete().eq("id", orgId);
    for (const id of Object.values(ids)) await admin.auth.admin.deleteUser(id);
    for (const sessionId of sessionIds) await admin.from("demo_sessions").delete().eq("id", sessionId);
  }
});
