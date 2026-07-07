import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface UpcomingConfirmation {
  job_id: string;
  instructor_id: string;
  job: {
    id: string;
    title: string;
    starts_on: string;
    start_time: string;
    organization_id: string;
    status: string;
  } | null;
}

/**
 * Periodiek onderhoud (Vercel Cron, elk uur):
 * - herinneringen 24 uur en 2 uur voor aanvang van bevestigde opdrachten;
 * - goedgekeurde documenten met een verstreken vervaldatum op "verlopen" zetten.
 *
 * Beveiliging: Vercel stuurt een Authorization-header met CRON_SECRET mee.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "service-role configuratie ontbreekt" },
      { status: 500 },
    );
  }

  const now = Date.now();
  const results = { reminders24h: 0, reminders2h: 0, expiredDocuments: 0 };

  // ---- Documenten verlopen markeren
  const { data: expired } = await supabase
    .from("document_uploads")
    .update({ status: "expired" })
    .eq("status", "approved")
    .lt("expires_at", new Date().toISOString().slice(0, 10))
    .select("id, user_id, doc_type");

  results.expiredDocuments = expired?.length ?? 0;

  for (const doc of expired ?? []) {
    await supabase.from("notifications").insert({
      user_id: doc.user_id,
      notification_type: "document_expired",
      title: "Document verlopen",
      body: "Een van je documenten is verlopen. Upload een nieuwe versie om je badge te behouden.",
      href: "/documenten",
    });
  }

  // ---- Herinneringen voor bevestigde opdrachten
  const { data: confirmations } = await supabase
    .from("job_confirmations")
    .select(
      `job_id, instructor_id,
      job:jobs (id, title, starts_on, start_time, organization_id, status)`,
    )
    .not("confirmed_at", "is", null)
    .gte("job.starts_on", new Date(now).toISOString().slice(0, 10));

  for (const confirmation of (confirmations as unknown as UpcomingConfirmation[]) ??
    []) {
    const job = confirmation.job;

    if (!job || job.status !== "confirmed") {
      continue;
    }

    const startsAt = new Date(
      `${job.starts_on}T${job.start_time}`,
    ).getTime();
    const hoursUntil = (startsAt - now) / (1000 * 60 * 60);

    const windows: { key: "reminder_24h" | "reminder_2h"; label: string }[] = [];
    if (hoursUntil > 0 && hoursUntil <= 24) {
      windows.push({ key: "reminder_24h", label: "morgen" });
    }
    if (hoursUntil > 0 && hoursUntil <= 2) {
      windows.push({ key: "reminder_2h", label: "over minder dan 2 uur" });
    }

    for (const window of windows) {
      // niet dubbel herinneren
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", confirmation.instructor_id)
        .eq("notification_type", window.key)
        .eq("href", `/opdrachten/${job.id}`)
        .limit(1);

      if (existing && existing.length > 0) {
        continue;
      }

      await supabase.from("notifications").insert({
        user_id: confirmation.instructor_id,
        notification_type: window.key,
        title: `Herinnering: ${job.title}`,
        body: `Je bevestigde opdracht begint ${window.label}.`,
        href: `/opdrachten/${job.id}`,
      });

      // ook de organisatieleden herinneren
      const { data: members } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", job.organization_id)
        .eq("state", "active")
        .not("user_id", "is", null);

      for (const member of members ?? []) {
        await supabase.from("notifications").insert({
          user_id: member.user_id,
          notification_type: window.key,
          title: `Herinnering: ${job.title}`,
          body: `De bevestigde opdracht begint ${window.label}.`,
          href: `/organisatie/opdrachten/${job.id}`,
        });
      }

      if (window.key === "reminder_24h") {
        results.reminders24h += 1;
      } else {
        results.reminders2h += 1;
      }
    }
  }

  return NextResponse.json({ ok: true, ...results });
}
