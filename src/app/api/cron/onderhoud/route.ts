import { NextResponse, type NextRequest } from "next/server";
import {
  amsterdamDateTimeToInstant,
  dateInAmsterdam,
} from "@/lib/datetime/amsterdam";
import { cleanupExpiredDemoSessions } from "@/lib/demo/factory";
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
 * Periodiek onderhoud (Vercel Cron, dagelijks om 03:00 UTC op Hobby):
 * - één herinnering zodra een bevestigde opdracht binnen 24 uur begint;
 * - goedgekeurde documenten met een verstreken vervaldatum op "verlopen" zetten.
 *
 * Een betrouwbare 2-uursherinnering vereist minimaal een hourly cron en staat
 * daarom uit zolang het bestaande Vercel-project op Hobby draait.
 *
 * Beveiliging: Vercel stuurt een Authorization-header met CRON_SECRET mee.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "cron is niet geconfigureerd" },
      { status: 503 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
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

  const now = new Date();
  const todayInAmsterdam = dateInAmsterdam(now);
  const results = {
    reminders24h: 0,
    reminders2h: 0,
    reminder2hEnabled: false,
    expiredDocuments: 0,
    expiredDemoSessions: 0,
  };

  results.expiredDemoSessions = await cleanupExpiredDemoSessions();

  // ---- Documenten verlopen markeren
  const { data: expired } = await supabase
    .from("document_uploads")
    .update({ status: "expired" })
    .eq("status", "approved")
    .lt("expires_at", todayInAmsterdam)
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
      job:jobs!inner (id, title, starts_on, start_time, organization_id, status)`,
    )
    .not("confirmed_at", "is", null)
    .eq("job.status", "confirmed")
    .gte("job.starts_on", todayInAmsterdam);

  for (const confirmation of (confirmations as unknown as UpcomingConfirmation[]) ??
    []) {
    const job = confirmation.job;

    if (!job || job.status !== "confirmed") {
      continue;
    }

    const startsAt = amsterdamDateTimeToInstant(job.starts_on, job.start_time);
    if (!startsAt) continue;

    const hoursUntil = (startsAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursUntil <= 0 || hoursUntil > 24) continue;

    const notificationType = "reminder_24h";
    const instructorHref = `/opdrachten/${job.id}`;
    const { data: existingInstructorReminder } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", confirmation.instructor_id)
      .eq("notification_type", notificationType)
      .eq("href", instructorHref)
      .limit(1);

    if (!existingInstructorReminder?.length) {
      const { error: reminderError } = await supabase.from("notifications").insert({
        user_id: confirmation.instructor_id,
        notification_type: notificationType,
        title: `Herinnering: ${job.title}`,
        body: "Je bevestigde opdracht begint binnen 24 uur.",
        href: instructorHref,
      });
      if (!reminderError || reminderError.code === "23505") {
        results.reminders24h += reminderError ? 0 : 1;
      }
    }

    const { data: members } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", job.organization_id)
      .eq("state", "active")
      .not("user_id", "is", null);

    for (const member of members ?? []) {
      if (!member.user_id) continue;
      const organizationHref = `/organisatie/opdrachten/${job.id}`;
      const { data: existingOrganizationReminder } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", member.user_id)
        .eq("notification_type", notificationType)
        .eq("href", organizationHref)
        .limit(1);
      if (existingOrganizationReminder?.length) continue;

      await supabase.from("notifications").insert({
        user_id: member.user_id,
        notification_type: notificationType,
        title: `Herinnering: ${job.title}`,
        body: "De bevestigde opdracht begint binnen 24 uur.",
        href: organizationHref,
      });
    }
  }

  return NextResponse.json({ ok: true, ...results });
}
