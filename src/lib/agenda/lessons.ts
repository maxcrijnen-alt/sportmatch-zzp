import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { JobStatus } from "@/types/database";

export interface AgendaSource {
  id: string;
  location_id: string;
  provider: "manual" | "synthetic";
  enabled: boolean;
  anchor_date: string;
  version: number;
  sync_status: "never" | "success" | "failed";
  last_synced_at: string | null;
  last_error: string | null;
  lesson_count: number;
}
export interface ScheduledLesson {
  id: string;
  source_id: string;
  organization_id: string;
  location_id: string;
  external_id: string;
  title: string;
  sport_id: string;
  lesson_type: string;
  starts_on: string;
  start_time: string;
  end_time: string;
  instructor_label: string;
  needs_substitute: boolean;
  cancelled: boolean;
  revision: number;
  source: { provider: "manual" | "synthetic"; enabled: boolean };
  location: { name: string };
  sport: { name: string };
  replacement: {
    job_id: string;
    lesson_revision: number;
    job: { status: JobStatus };
  } | null;
}

const lessonSelect = `id,source_id,organization_id,location_id,external_id,title,sport_id,lesson_type,
  starts_on,start_time,end_time,instructor_label,needs_substitute,cancelled,revision,
  source:agenda_sources!inner(provider,enabled),location:organization_locations(name),
  sport:sports(name),replacement:lesson_replacement_jobs(job_id,lesson_revision,job:jobs(status))`;

export async function listScheduledLessons(
  organizationId: string,
  locationId?: string | null,
) {
  const client = await createClient();
  if (!client) return [];
  const lessons: ScheduledLesson[] = [];
  for (let page = 0; page < 20; page += 1) {
    let query = client
      .from("scheduled_lessons")
      .select(lessonSelect)
      .eq("organization_id", organizationId)
      .eq("source.enabled", true)
      .order("starts_on")
      .order("start_time")
      .order("id")
      .range(page * 500, page * 500 + 499);
    if (locationId) query = query.eq("location_id", locationId);
    const { data, error } = await query;
    if (error)
      throw new Error(
        "Het lesrooster kon niet worden geladen. Probeer het opnieuw.",
      );
    lessons.push(...((data ?? []) as unknown as ScheduledLesson[]));
    if ((data?.length ?? 0) < 500) return lessons;
  }
  throw new Error(
    "Dit rooster is te groot om volledig te laden. Kies een vestiging.",
  );
}

export async function getScheduledLesson(organizationId: string, id: string) {
  const client = await createClient();
  if (!client) return null;
  const { data, error } = await client
    .from("scheduled_lessons")
    .select(lessonSelect)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("De les kon niet worden geladen.");
  return data as unknown as ScheduledLesson | null;
}

export async function listAgendaSources(organizationId: string) {
  const client = await createClient();
  if (!client) return [];
  const { data, error } = await client
    .from("agenda_sources")
    .select(
      "id,location_id,provider,enabled,anchor_date,version,sync_status,last_synced_at,last_error,lesson_count",
    )
    .eq("organization_id", organizationId);
  if (error) throw new Error("De roosterbronnen konden niet worden geladen.");
  return (data ?? []) as AgendaSource[];
}
