"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getOrgContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
import { dateInAmsterdam } from "@/lib/datetime/amsterdam";
import { occurrenceDates } from "@/lib/jobs/schedule";
import { lessonBatchSchema, lessonInputSchema } from "./lesson-contract";
import { listAgendaSources } from "./lessons";
import { syntheticLessonProvider } from "./source-providers";

export interface AgendaActionState {
  error: string | null;
  success?: string;
}

export async function saveLessonAction(
  _: AgendaActionState,
  form: FormData,
): Promise<AgendaActionState> {
  const org = await getOrgContext();
  const client = await createClient();
  if (!org || !client)
    return { error: "Je hebt geen toegang tot dit lesrooster." };
  const locationId = String(form.get("locationId") ?? "");
  if (!org.locations.some((location) => location.id === locationId))
    return { error: "Kies een eigen vestiging." };
  const parsed = lessonInputSchema.safeParse({
    externalId: form.get("externalId"),
    revision: Number(form.get("revision")),
    title: form.get("title"),
    sportId: form.get("sportId"),
    lessonType: form.get("lessonType"),
    date: form.get("date"),
    startTime: form.get("startTime"),
    endTime: form.get("endTime"),
    instructor: form.get("instructor") ?? "",
    needsSubstitute: form.get("needsSubstitute") === "on",
    cancelled: form.get("cancelled") === "on",
  });
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "Controleer de lesgegevens.",
    };
  const count = z.coerce
    .number()
    .int()
    .min(1)
    .max(52)
    .safeParse(form.get("count") ?? 1);
  if (!count.success || (parsed.data.revision > 0 && count.data !== 1))
    return {
      error: "Kies maximaal 52 lessen; bewerk bestaande lessen afzonderlijk.",
    };
  const input = parsed.data;
  const lessons = lessonBatchSchema.safeParse(
    occurrenceDates({
      starts_on: input.date,
      recurrence:
        count.data > 1
          ? { interval_weeks: 1, occurrence_count: count.data, ends_on: null }
          : null,
    }).map((date) => ({
      ...input,
      date,
      externalId:
        count.data > 1 ? `${input.externalId}/${date}` : input.externalId,
    })),
  );
  if (!lessons.success)
    return {
      error: lessons.error.issues[0]?.message ?? "Controleer het lesrooster.",
    };
  const { error } = await client.rpc("save_agenda_lessons", {
    p_location: locationId,
    p_provider: "manual",
    p_anchor: dateInAmsterdam(new Date()),
    p_version: null,
    p_enabled: true,
    p_lessons: lessons.data,
  });
  if (error)
    return {
      error:
        error.code === "P0001"
          ? error.message
          : "Opslaan is niet gelukt. Controleer de gegevens en vernieuw de pagina.",
    };
  const { data: lesson } = await client
    .from("scheduled_lessons")
    .select("id")
    .eq("organization_id", org.organization.id)
    .eq("location_id", locationId)
    .eq("external_id", lessons.data[0].externalId)
    .single();
  revalidatePath("/agenda", "layout");
  redirect(lesson ? `/agenda/lessen/${lesson.id}` : "/agenda");
}

export async function syncExampleAction(
  _: AgendaActionState,
  form: FormData,
): Promise<AgendaActionState> {
  const org = await getOrgContext();
  const client = await createClient();
  if (!org || !client || org.memberRole !== "owner")
    return { error: "Alleen een eigenaar beheert voorbeeldkoppelingen." };
  const locationId = String(form.get("locationId") ?? "");
  if (!org.locations.some((location) => location.id === locationId))
    return { error: "Kies een eigen vestiging." };
  const version = z.coerce.number().int().min(0).safeParse(form.get("version"));
  if (!version.success)
    return { error: "Vernieuw de pagina en probeer het opnieuw." };
  const source = (await listAgendaSources(org.organization.id)).find(
    (item) => item.location_id === locationId && item.provider === "synthetic",
  );
  const anchor = source?.anchor_date ?? dateInAmsterdam(new Date());
  const enabled = form.get("enabled") === "true";
  const { data: sport } = await client
    .from("sports")
    .select("id")
    .eq("slug", "fitness")
    .eq("is_active", true)
    .single();
  if (!sport)
    return { error: "De sport voor het voorbeeldrooster is niet beschikbaar." };
  const lessons = enabled
    ? await syntheticLessonProvider.loadLessons(anchor, sport.id)
    : [];
  const { data, error } = await client.rpc("save_agenda_lessons", {
    p_location: locationId,
    p_provider: "synthetic",
    p_anchor: anchor,
    p_version: version.data,
    p_enabled: enabled,
    p_lessons: lessons,
  });
  if (error)
    return {
      error:
        error.code === "P0001"
          ? error.message
          : "Synchroniseren is niet gelukt. Probeer het opnieuw.",
    };
  revalidatePath("/agenda", "layout");
  if (!data?.ok)
    return {
      error:
        "Het voorbeeldrooster is afgewezen. De vorige lessen zijn behouden.",
    };
  return {
    error: null,
    success: enabled
      ? `Voorbeeldrooster gesynchroniseerd; ${data.changed} lessen toegevoegd of gewijzigd.`
      : "Voorbeeldrooster verborgen.",
  };
}
