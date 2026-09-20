"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSessionProfile } from "@/lib/auth/session";
import { getOrgContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";

export interface JobActionState {
  error: string | null;
  success: string | null;
}

const initialError = (message: string): JobActionState => ({
  error: message,
  success: null,
});

function rpcErrorMessage(error: { message?: string } | null): string {
  // RPC's geven Nederlandse foutmeldingen via raise exception
  return error?.message ?? "Er is iets misgegaan. Probeer het opnieuw.";
}

// ---------------------------------------------------------------------------
// Opdracht plaatsen en beheren (organisatie)
// ---------------------------------------------------------------------------

const createJobSchema = z
  .object({
    jobType: z.enum([
      "urgent_substitute",
      "one_time",
      "recurring",
      "temporary",
      "permanent",
    ]),
    sportId: z.string().uuid("Kies een sport of lestype."),
    lessonTypeId: z.string().uuid("Kies een soort les.").optional(),
    customLessonType: z.string().trim().max(100).default(""),
    locationId: z.string().uuid("Kies een vestiging."),
    title: z.string().min(5, "Geef de opdracht een duidelijke titel."),
    description: z.string().min(10, "Beschrijf de opdracht."),
    startsOn: z.string().min(1, "Kies een datum."),
    startTime: z.string().min(1, "Kies een begintijd."),
    endTime: z.string().min(1, "Kies een eindtijd."),
    recurrenceNote: z.string().default(""),
    payType: z.enum(["fixed", "hourly"]),
    payAmountEuro: z.coerce.number().min(0).optional(),
    payHourlyRateEuro: z.coerce.number().min(0).optional(),
    payIsNegotiable: z.boolean(),
    requiredLevel: z.string().default(""),
    expectedParticipants: z.coerce.number().int().min(0).optional(),
    contactName: z.string().min(2, "Vul een contactpersoon in."),
    qualificationIds: z.array(z.string().uuid()).default([]),
    intervalWeeks: z.coerce.number().int().min(1).max(52).optional(),
    occurrenceCount: z.coerce.number().int().min(2).max(104).optional(),
    endsOn: z.string().optional(),
    partialBlockAllowed: z.boolean(),
    saveAsTemplate: z.boolean(),
    templateName: z.string().trim().max(100).default(""),
  })
  .superRefine((value, ctx) => {
    if (!value.lessonTypeId && value.customLessonType.length < 2) {
      ctx.addIssue({
        code: "custom",
        message: "Kies een soort les of vul een eigen lesvorm in.",
        path: ["lessonTypeId"],
      });
    }
    if (value.startTime >= value.endTime) {
      ctx.addIssue({
        code: "custom",
        message: "De eindtijd moet na de begintijd liggen.",
        path: ["endTime"],
      });
    }
    if (
      value.payType === "fixed" &&
      !value.payAmountEuro
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Vul het vaste bedrag in.",
        path: ["payAmountEuro"],
      });
    }
    if (
      value.payType === "hourly" &&
      !value.payHourlyRateEuro
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Vul het uurtarief in.",
        path: ["payHourlyRateEuro"],
      });
    }
    if (value.jobType === "recurring" && value.recurrenceNote.trim().length < 3) {
      ctx.addIssue({
        code: "custom",
        message: "Beschrijf het terugkerende ritme (bijv. elke dinsdagavond).",
        path: ["recurrenceNote"],
      });
    }
  });

const jobSegmentSchema = z
  .object({
    position: z.number().int().positive(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    lessonTypeId: z.string().uuid().nullable(),
    customLessonType: z.string().trim().max(100).default(""),
    level: z.string().max(100).default(""),
  })
  .superRefine((segment, ctx) => {
    if (!segment.lessonTypeId && segment.customLessonType.length < 2) {
      ctx.addIssue({
        code: "custom",
        message: "Kies per les een lesvorm of vul een eigen lesvorm in.",
        path: ["customLessonType"],
      });
    }
  });

export async function createJobAction(
  _previous: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const profile = await getSessionProfile();
  const orgContext = await getOrgContext();
  const supabase = await createClient();

  if (!profile || !supabase) {
    return initialError("Je bent niet ingelogd.");
  }

  if (!orgContext) {
    return initialError("Je bent geen lid van een organisatie.");
  }

  const parsed = createJobSchema.safeParse({
    jobType: formData.get("jobType"),
    sportId: formData.get("sportId"),
    lessonTypeId:
      formData.get("lessonTypeId") === "custom"
        ? undefined
        : formData.get("lessonTypeId") || undefined,
    customLessonType: formData.get("customLessonType") ?? "",
    locationId: formData.get("locationId"),
    title: formData.get("title"),
    description: formData.get("description"),
    startsOn: formData.get("startsOn"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    recurrenceNote: formData.get("recurrenceNote") ?? "",
    payType: formData.get("payType"),
    payAmountEuro: formData.get("payAmountEuro") || undefined,
    payHourlyRateEuro: formData.get("payHourlyRateEuro") || undefined,
    payIsNegotiable: formData.get("payIsNegotiable") === "on",
    requiredLevel: formData.get("requiredLevel") ?? "",
    expectedParticipants: formData.get("expectedParticipants") || undefined,
    contactName: formData.get("contactName"),
    qualificationIds: formData.getAll("qualificationIds"),
    intervalWeeks: formData.get("intervalWeeks") || undefined,
    occurrenceCount: formData.get("occurrenceCount") || undefined,
    endsOn: String(formData.get("endsOn") ?? "") || undefined,
    partialBlockAllowed: formData.get("partialBlockAllowed") === "on",
    saveAsTemplate: formData.get("saveAsTemplate") === "on",
    templateName: formData.get("templateName") ?? "",
  });

  if (!parsed.success) {
    return initialError(parsed.error.issues[0]?.message ?? "Ongeldige invoer.");
  }

  const input = parsed.data;

  let segments: z.infer<typeof jobSegmentSchema>[] = [];
  const segmentsJson = String(formData.get("segmentsJson") ?? "");
  if (segmentsJson) {
    try {
      const segmentsResult = z.array(jobSegmentSchema).min(2).max(12).safeParse(
        JSON.parse(segmentsJson),
      );
      if (!segmentsResult.success) {
        return initialError("Controleer de tijden en lesvormen in het lessenblok.");
      }
      segments = segmentsResult.data;
    } catch {
      return initialError("Het lessenblok kon niet worden gelezen.");
    }

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      if (segment.startTime >= segment.endTime) {
        return initialError("Iedere les moet een eindtijd na de begintijd hebben.");
      }
      if (index > 0 && segments[index - 1].endTime !== segment.startTime) {
        return initialError("Lessen in een blok moeten direct op elkaar aansluiten.");
      }
    }
  }

  if (!orgContext.locations.some((location) => location.id === input.locationId)) {
    return initialError("Deze vestiging hoort niet bij jouw organisatie.");
  }

  const segmentLessonTypeIds = Array.from(
    new Set(
      segments
        .map((segment) => segment.lessonTypeId)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const [{ data: pendingReview }, lessonTypeResult, segmentLessonTypesResult] =
    await Promise.all([
      supabase.rpc("has_pending_review", { target_user: profile.id }),
      input.lessonTypeId
        ? supabase
            .from("lesson_types")
            .select("id")
            .eq("id", input.lessonTypeId)
            .eq("sport_id", input.sportId)
            .eq("is_active", true)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      segmentLessonTypeIds.length > 0
        ? supabase
            .from("lesson_types")
            .select("id")
            .in("id", segmentLessonTypeIds)
            .eq("sport_id", input.sportId)
            .eq("is_active", true)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (pendingReview === true) {
    return initialError(
      "Je hebt nog een beoordeling openstaan. Rond die eerst af voordat je een nieuwe opdracht plaatst.",
    );
  }
  if (input.lessonTypeId && !lessonTypeResult.data) {
    return initialError("De gekozen lesvorm hoort niet bij deze sport.");
  }
  if (
    segmentLessonTypesResult.error ||
    (segmentLessonTypesResult.data?.length ?? 0) !== segmentLessonTypeIds.length
  ) {
    return initialError("Een lesvorm in het lessenblok hoort niet bij deze sport.");
  }

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      organization_id: orgContext.organization.id,
      location_id: input.locationId,
      created_by: profile.id,
      job_type: input.jobType,
      sport_id: input.sportId,
      lesson_type_id: input.lessonTypeId ?? null,
      custom_lesson_type: input.lessonTypeId ? null : input.customLessonType,
      title: input.title,
      description: input.description,
      starts_on: input.startsOn,
      start_time: segments[0]?.startTime ?? input.startTime,
      end_time: segments.at(-1)?.endTime ?? input.endTime,
      recurrence_note: input.recurrenceNote,
      pay_type: input.payType,
      pay_amount_cents: input.payAmountEuro
        ? Math.round(input.payAmountEuro * 100)
        : null,
      pay_hourly_rate_cents: input.payHourlyRateEuro
        ? Math.round(input.payHourlyRateEuro * 100)
        : null,
      pay_is_negotiable: input.payIsNegotiable,
      required_level: input.requiredLevel,
      expected_participants: input.expectedParticipants ?? null,
      contact_name: input.contactName,
      partial_block_allowed: segments.length > 0 && input.partialBlockAllowed,
      demo_session_id: profile.demo_session_id,
    })
    .select("id")
    .single();

  if (error || !job) {
    if (error?.code === "42501") {
      return initialError(
        "Opdracht plaatsen is geblokkeerd. Controleer je openstaande beoordeling en het abonnement van deze vestiging.",
      );
    }
    return initialError("Opdracht plaatsen is niet gelukt.");
  }

  if (input.qualificationIds.length > 0) {
    const { error: requirementsError } = await supabase.from("job_requirements").insert(
      input.qualificationIds.map((qualificationId) => ({
        job_id: job.id,
        qualification_id: qualificationId,
      })),
    );
    if (requirementsError) {
      return initialError("De opdracht is geplaatst, maar de diploma-eisen konden niet worden opgeslagen.");
    }
  }

  if (input.jobType === "recurring") {
    const weekday = new Date(`${input.startsOn}T12:00:00`).getDay();
    const { error: recurrenceError } = await supabase
      .from("job_recurrence_rules")
      .insert({
        job_id: job.id,
        interval_weeks: input.intervalWeeks ?? 1,
        weekdays: [weekday],
        ends_on: input.endsOn ?? null,
        occurrence_count: input.occurrenceCount ?? null,
      });
    if (recurrenceError) {
      return initialError("De opdracht is geplaatst, maar de herhaling kon niet worden opgeslagen.");
    }
  }

  if (segments.length > 0) {
    const { error: segmentsError } = await supabase.from("job_segments").insert(
      segments.map((segment) => ({
        job_id: job.id,
        position: segment.position,
        start_time: segment.startTime,
        end_time: segment.endTime,
        lesson_type_id: segment.lessonTypeId,
        custom_lesson_type: segment.lessonTypeId
          ? null
          : segment.customLessonType,
        level: segment.level,
      })),
    );
    if (segmentsError) {
      return initialError("De opdracht is geplaatst, maar het lessenblok kon niet worden opgeslagen.");
    }
  }

  if (input.saveAsTemplate) {
    await supabase.from("job_templates").insert({
      organization_id: orgContext.organization.id,
      created_by: profile.id,
      name: input.templateName || input.title,
      template_data: {
        jobType: input.jobType,
        sportId: input.sportId,
        lessonTypeId: input.lessonTypeId ?? "custom",
        customLessonType: input.customLessonType,
        locationId: input.locationId,
        title: input.title,
        description: input.description,
        recurrenceNote: input.recurrenceNote,
        payType: input.payType,
        payAmountEuro: input.payAmountEuro,
        payHourlyRateEuro: input.payHourlyRateEuro,
        payIsNegotiable: input.payIsNegotiable,
        requiredLevel: input.requiredLevel,
        expectedParticipants: input.expectedParticipants,
        qualificationIds: input.qualificationIds,
        intervalWeeks: input.intervalWeeks,
        occurrenceCount: input.occurrenceCount,
        endsOn: input.endsOn,
        partialBlockAllowed:
          segments.length > 0 && input.partialBlockAllowed,
        segments: segments.map((segment) => ({
          startTime: segment.startTime,
          endTime: segment.endTime,
          lessonTypeId: segment.lessonTypeId ?? "custom",
          customLessonType: segment.customLessonType,
          level: segment.level,
        })),
      },
    });
  }

  revalidatePath("/organisatie/opdrachten");
  redirect(`/organisatie/opdrachten/${job.id}`);
}

const stopSearchSchema = z.object({
  jobId: z.string().uuid(),
  reason: z.enum([
    "match_via_sportmatch",
    "internal_match",
    "lesson_cancelled",
    "no_longer_needed",
    "other",
  ]),
  note: z.string().max(500).default(""),
});

export async function stopJobSearchAction(
  _previous: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const supabase = await createClient();

  if (!supabase) {
    return initialError("Je bent niet ingelogd.");
  }

  const parsed = stopSearchSchema.safeParse({
    jobId: formData.get("jobId"),
    reason: formData.get("reason"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    return initialError(parsed.error.issues[0]?.message ?? "Kies een geldige reden.");
  }

  const { error } = await supabase.rpc("stop_job_search", {
    p_job: parsed.data.jobId,
    p_reason: parsed.data.reason,
    p_note: parsed.data.note,
  });
  if (error) return initialError(rpcErrorMessage(error));

  revalidatePath("/organisatie/opdrachten");
  revalidatePath(`/organisatie/opdrachten/${parsed.data.jobId}`);
  return { error: null, success: "Nieuwe instructeurs kunnen niet meer reageren." };
}

export async function saveJobAsTemplateAction(jobId: string): Promise<void> {
  const profile = await getSessionProfile();
  const orgContext = await getOrgContext();
  const supabase = await createClient();
  if (!profile || !orgContext || !supabase) return;

  const [
    { data: job },
    { data: requirements },
    { data: segments },
    { data: recurrence },
  ] = await Promise.all([
    supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .eq("organization_id", orgContext.organization.id)
      .maybeSingle(),
    supabase
      .from("job_requirements")
      .select("qualification_id")
      .eq("job_id", jobId),
    supabase
      .from("job_segments")
      .select("start_time, end_time, lesson_type_id, custom_lesson_type, level")
      .eq("job_id", jobId)
      .order("position"),
    supabase
      .from("job_recurrence_rules")
      .select("interval_weeks, occurrence_count, ends_on")
      .eq("job_id", jobId)
      .maybeSingle(),
  ]);
  if (!job) return;

  await supabase.from("job_templates").insert({
    organization_id: orgContext.organization.id,
    created_by: profile.id,
    name: job.title as string,
    template_data: {
      jobType: job.job_type,
      sportId: job.sport_id,
      lessonTypeId:
        job.lesson_type_id ?? (job.custom_lesson_type ? "custom" : undefined),
      customLessonType: job.custom_lesson_type,
      locationId: job.location_id,
      title: job.title,
      description: job.description,
      recurrenceNote: job.recurrence_note,
      payType:
        job.pay_type === "fixed" || job.pay_hourly_rate_cents == null
          ? "fixed"
          : "hourly",
      payAmountEuro:
        job.pay_amount_cents == null ? undefined : job.pay_amount_cents / 100,
      payHourlyRateEuro:
        job.pay_hourly_rate_cents == null
          ? undefined
          : job.pay_hourly_rate_cents / 100,
      payIsNegotiable: job.pay_is_negotiable,
      requiredLevel: job.required_level,
      expectedParticipants: job.expected_participants,
      qualificationIds:
        requirements?.map((item) => item.qualification_id as string) ?? [],
      intervalWeeks: recurrence?.interval_weeks ?? undefined,
      occurrenceCount: recurrence?.occurrence_count ?? undefined,
      endsOn: recurrence?.ends_on ?? undefined,
      partialBlockAllowed: Boolean(job.partial_block_allowed),
      segments:
        segments?.map((segment) => ({
          startTime: String(segment.start_time).slice(0, 5),
          endTime: String(segment.end_time).slice(0, 5),
          lessonTypeId: segment.lesson_type_id
            ? (segment.lesson_type_id as string)
            : "custom",
          customLessonType:
            (segment.custom_lesson_type as string | null) ?? undefined,
          level: (segment.level as string | null) ?? undefined,
        })) ?? [],
    },
  });

  revalidatePath("/organisatie/opdrachten/nieuw");
}

// ---------------------------------------------------------------------------
// Reageren en uitnodigen
// ---------------------------------------------------------------------------

export async function applyToJobAction(
  _previous: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const supabase = await createClient();

  if (!supabase) {
    return initialError("Je bent niet ingelogd.");
  }

  const jobId = String(formData.get("jobId") ?? "");
  const message = String(formData.get("message") ?? "");
  const availabilityNote = String(formData.get("availabilityNote") ?? "");
  const segmentIds = formData
    .getAll("segmentIds")
    .map(String)
    .filter(Boolean);

  const { error } = await supabase.rpc("apply_to_job", {
    p_job: jobId,
    p_message: message,
    p_availability_note: availabilityNote,
    p_segment_ids: segmentIds.length > 0 ? segmentIds : null,
  });

  if (error) {
    return initialError(rpcErrorMessage(error));
  }

  revalidatePath(`/opdrachten/${jobId}`);
  revalidatePath("/mijn-reacties");
  return { error: null, success: "Je reactie is verstuurd!" };
}

export async function withdrawApplicationAction(
  applicationId: string,
): Promise<void> {
  const supabase = await createClient();

  if (!supabase) {
    return;
  }

  await supabase.rpc("withdraw_application", { p_application: applicationId });
  revalidatePath("/mijn-reacties");
}

export async function inviteInstructorAction(
  _previous: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const supabase = await createClient();

  if (!supabase) {
    return initialError("Je bent niet ingelogd.");
  }

  const jobId = String(formData.get("jobId") ?? "");
  const instructorId = String(formData.get("instructorId") ?? "");
  const message = String(formData.get("message") ?? "");

  const { error } = await supabase.rpc("invite_instructor", {
    p_job: jobId,
    p_instructor: instructorId,
    p_message: message,
  });

  if (error) {
    return initialError(rpcErrorMessage(error));
  }

  revalidatePath(`/organisatie/opdrachten/${jobId}`);
  return { error: null, success: "Uitnodiging verstuurd." };
}

export async function respondInvitationAction(
  invitationId: string,
  accept: boolean,
): Promise<void> {
  const supabase = await createClient();

  if (!supabase) {
    return;
  }

  await supabase.rpc("respond_invitation", {
    p_invitation: invitationId,
    p_accept: accept,
  });

  revalidatePath("/opdrachten");
  revalidatePath("/mijn-reacties");
}

// ---------------------------------------------------------------------------
// Tegenvoorstellen
// ---------------------------------------------------------------------------

const counterofferSchema = z.object({
  applicationId: z.string().uuid(),
  payType: z.enum(["fixed", "hourly"]),
  amountEuro: z.coerce.number().min(1, "Vul een geldig bedrag in."),
  message: z.string().default(""),
});

export async function createCounterofferAction(
  _previous: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const supabase = await createClient();

  if (!supabase) {
    return initialError("Je bent niet ingelogd.");
  }

  const parsed = counterofferSchema.safeParse({
    applicationId: formData.get("applicationId"),
    payType: formData.get("payType"),
    amountEuro: formData.get("amountEuro"),
    message: formData.get("message") ?? "",
  });

  if (!parsed.success) {
    return initialError(parsed.error.issues[0]?.message ?? "Ongeldige invoer.");
  }

  const { error } = await supabase.rpc("create_counteroffer", {
    p_application: parsed.data.applicationId,
    p_pay_type: parsed.data.payType,
    p_amount_cents: Math.round(parsed.data.amountEuro * 100),
    p_message: parsed.data.message,
  });

  if (error) {
    return initialError(rpcErrorMessage(error));
  }

  revalidatePath("/mijn-reacties");
  return { error: null, success: "Tegenvoorstel verstuurd." };
}

export async function respondCounterofferAction(
  counterofferId: string,
  accept: boolean,
  revalidate: string,
): Promise<void> {
  const supabase = await createClient();

  if (!supabase) {
    return;
  }

  await supabase.rpc("respond_counteroffer", {
    p_offer: counterofferId,
    p_accept: accept,
  });

  revalidatePath(revalidate);
}

// ---------------------------------------------------------------------------
// Kandidaat kiezen en bevestigen
// ---------------------------------------------------------------------------

export async function selectCandidateAction(
  _previous: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const supabase = await createClient();

  if (!supabase) {
    return initialError("Je bent niet ingelogd.");
  }

  const applicationId = String(formData.get("applicationId") ?? "");
  const termsNote = String(formData.get("termsNote") ?? "");
  const jobId = String(formData.get("jobId") ?? "");
  const segmentIds = formData.getAll("segmentIds").map(String).filter(Boolean);

  const { error } = segmentIds.length > 0
    ? await supabase.rpc("select_candidate_segments", {
        p_application: applicationId,
        p_segment_ids: segmentIds,
        p_terms: { note: termsNote },
      })
    : await supabase.rpc("select_candidate", {
        p_application: applicationId,
        p_terms: { note: termsNote },
      });

  if (error) {
    return initialError(rpcErrorMessage(error));
  }

  revalidatePath(`/organisatie/opdrachten/${jobId}`);
  return {
    error: null,
    success:
      "Kandidaat gekozen. De opdracht is definitief zodra de instructeur bevestigt.",
  };
}

export async function confirmJobAction(
  _previous: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const supabase = await createClient();

  if (!supabase) {
    return initialError("Je bent niet ingelogd.");
  }

  const jobId = String(formData.get("jobId") ?? "");
  const { count: segmentCount } = await supabase
    .from("job_segment_confirmations")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId)
    .is("confirmed_at", null);

  const { error } = segmentCount
    ? await supabase.rpc("confirm_job_segments", { p_job: jobId })
    : await supabase.rpc("confirm_job", { p_job: jobId });

  if (error) {
    return initialError(rpcErrorMessage(error));
  }

  revalidatePath(`/opdrachten/${jobId}`);
  return {
    error: null,
    success: "Opdracht bevestigd! Contactgegevens zijn nu zichtbaar.",
  };
}

// ---------------------------------------------------------------------------
// Annulering, vervanging, no-show, afronden
// ---------------------------------------------------------------------------

export async function cancelJobAction(
  _previous: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile || !supabase) {
    return initialError("Je bent niet ingelogd.");
  }

  const jobId = String(formData.get("jobId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const forceMajeure = formData.get("forceMajeure") === "on";
  const evidence = formData.get("evidence");
  let evidencePath: string | null = null;

  if (forceMajeure && evidence instanceof File && evidence.size > 0) {
    if (evidence.size > 10 * 1024 * 1024) {
      return initialError("Bewijs mag maximaal 10 MB zijn.");
    }
    if (!evidence.type.startsWith("image/") && evidence.type !== "application/pdf") {
      return initialError("Upload een afbeelding of pdf als bewijs.");
    }
    const extension = evidence.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "bin";
    evidencePath = `${profile.id}/cancellations/${jobId}/${randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(evidencePath, evidence, { contentType: evidence.type, upsert: false });
    if (uploadError) return initialError("Het bewijs kon niet privé worden opgeslagen.");
  }

  const { error } = await supabase.rpc("cancel_confirmed_job", {
    p_job: jobId,
    p_reason: reason,
    p_force_majeure: forceMajeure,
    p_evidence_path: evidencePath,
  });

  if (error) {
    if (evidencePath) await supabase.storage.from("documents").remove([evidencePath]);
    return initialError(rpcErrorMessage(error));
  }

  revalidatePath(`/opdrachten/${jobId}`);
  revalidatePath(`/organisatie/opdrachten/${jobId}`);
  return {
    error: null,
    success: forceMajeure
      ? "De opdracht is geannuleerd. Het overmachtsverzoek wacht op beoordeling."
      : "De opdracht is geannuleerd en 150% van de afgesproken vergoeding is geregistreerd (zonder automatische betaling).",
  };
}

export async function proposeReplacementAction(
  _previous: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const supabase = await createClient();

  if (!supabase) {
    return initialError("Je bent niet ingelogd.");
  }

  const jobId = String(formData.get("jobId") ?? "");
  const replacementId = String(formData.get("replacementId") ?? "");
  const reason = String(formData.get("reason") ?? "");

  if (!replacementId) {
    return initialError("Kies een vervanger.");
  }

  const { error } = await supabase.rpc("propose_replacement", {
    p_job: jobId,
    p_replacement: replacementId,
    p_reason: reason,
  });

  if (error) {
    return initialError(rpcErrorMessage(error));
  }

  revalidatePath(`/opdrachten/${jobId}`);
  return {
    error: null,
    success: "Vervanger voorgesteld. De organisatie beoordeelt het voorstel.",
  };
}

export async function decideReplacementAction(
  replacementId: string,
  approve: boolean,
  jobId: string,
): Promise<void> {
  const supabase = await createClient();

  if (!supabase) {
    return;
  }

  await supabase.rpc("decide_replacement", {
    p_replacement: replacementId,
    p_approve: approve,
  });

  revalidatePath(`/organisatie/opdrachten/${jobId}`);
}

export async function recordNoShowAction(
  _previous: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const supabase = await createClient();

  if (!supabase) {
    return initialError("Je bent niet ingelogd.");
  }

  const jobId = String(formData.get("jobId") ?? "");
  const note = String(formData.get("note") ?? "");

  const { error } = await supabase.rpc("record_no_show", {
    p_job: jobId,
    p_note: note,
  });

  if (error) {
    return initialError(rpcErrorMessage(error));
  }

  revalidatePath(`/organisatie/opdrachten/${jobId}`);
  return { error: null, success: "No-show geregistreerd." };
}

export async function completeJobAction(jobId: string): Promise<void> {
  const supabase = await createClient();

  if (!supabase) {
    return;
  }

  await supabase.rpc("complete_job", { p_job: jobId });
  revalidatePath(`/organisatie/opdrachten/${jobId}`);
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export async function submitReviewAction(
  _previous: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile || !supabase) {
    return initialError("Je bent niet ingelogd.");
  }

  const jobId = String(formData.get("jobId") ?? "");
  const rating = Number(formData.get("rating") ?? 0);
  const comment = String(formData.get("comment") ?? "");
  const revieweeId = String(formData.get("revieweeId") ?? "") || null;
  const alsoReport = formData.get("alsoReport") === "on";
  const reportDetails = String(formData.get("reportDetails") ?? "");

  const { data: reviewId, error } = await supabase.rpc("submit_review", {
    p_job: jobId,
    p_rating: rating,
    p_comment: comment,
    p_reviewee: revieweeId,
  });

  if (error) {
    return initialError(rpcErrorMessage(error));
  }

  if (alsoReport && rating <= 2) {
    if (reportDetails.trim().length < 10) {
      return initialError(
        "Je beoordeling is opgeslagen. Geef voor een melding minimaal 10 tekens toelichting.",
      );
    }
    const { error: complaintError } = await supabase.from("complaints").insert({
      job_id: jobId,
      reported_by: profile.id,
      category: "conduct",
      details: reportDetails.trim(),
      review_id: reviewId,
    });
    if (complaintError) {
      return initialError(
        "Je beoordeling is opgeslagen, maar de aparte melding kon niet worden verstuurd.",
      );
    }
  }

  revalidatePath(`/opdrachten/${jobId}`);
  revalidatePath(`/organisatie/opdrachten/${jobId}`);
  revalidatePath("/reviews");
  return { error: null, success: "Bedankt voor je beoordeling!" };
}

const complaintSchema = z.object({
  jobId: z.string().uuid(),
  category: z.enum(["safety", "conduct", "agreement", "no_show", "payment", "other"]),
  details: z.string().trim().min(10, "Geef minimaal 10 tekens toelichting.").max(5000),
});

export async function reportProblemAction(
  _previous: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const profile = await getSessionProfile();
  const supabase = await createClient();
  if (!profile || !supabase) return initialError("Je bent niet ingelogd.");

  const parsed = complaintSchema.safeParse({
    jobId: formData.get("jobId"),
    category: formData.get("category"),
    details: formData.get("details"),
  });
  if (!parsed.success) {
    return initialError(parsed.error.issues[0]?.message ?? "Controleer je melding.");
  }

  const complaintId = randomUUID();
  const evidence = formData.get("evidence");
  let evidencePath: string | null = null;

  if (evidence instanceof File && evidence.size > 0) {
    if (evidence.size > 10 * 1024 * 1024) {
      return initialError("Bewijs mag maximaal 10 MB zijn.");
    }
    if (!evidence.type.startsWith("image/") && evidence.type !== "application/pdf") {
      return initialError("Upload een afbeelding of pdf als bewijs.");
    }
    const extension = evidence.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "bin";
    evidencePath = `${profile.id}/complaints/${complaintId}/bewijs.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(evidencePath, evidence, { contentType: evidence.type, upsert: false });
    if (uploadError) return initialError("Het bewijsbestand kon niet veilig worden opgeslagen.");
  }

  const { error } = await supabase.from("complaints").insert({
    id: complaintId,
    job_id: parsed.data.jobId,
    reported_by: profile.id,
    category: parsed.data.category,
    details: parsed.data.details,
    evidence_path: evidencePath,
  });
  if (error) {
    if (evidencePath) {
      await supabase.storage.from("documents").remove([evidencePath]);
    }
    return initialError("De melding kon niet worden verstuurd. Alleen betrokkenen kunnen melden.");
  }

  revalidatePath(`/opdrachten/${parsed.data.jobId}`);
  revalidatePath(`/organisatie/opdrachten/${parsed.data.jobId}`);
  return { error: null, success: "Je melding is privé ontvangen door SportMatch." };
}
