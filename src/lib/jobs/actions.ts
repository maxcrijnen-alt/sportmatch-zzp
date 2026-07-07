"use server";

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
    locationId: z.string().uuid("Kies een vestiging."),
    title: z.string().min(5, "Geef de opdracht een duidelijke titel."),
    description: z.string().min(10, "Beschrijf de opdracht."),
    startsOn: z.string().min(1, "Kies een datum."),
    startTime: z.string().min(1, "Kies een begintijd."),
    endTime: z.string().min(1, "Kies een eindtijd."),
    recurrenceNote: z.string().default(""),
    payType: z.enum(["fixed", "hourly", "both"]),
    payAmountEuro: z.coerce.number().min(0).optional(),
    payHourlyRateEuro: z.coerce.number().min(0).optional(),
    payIsNegotiable: z.boolean(),
    requiredLevel: z.string().default(""),
    expectedParticipants: z.coerce.number().int().min(0).optional(),
    contactName: z.string().min(2, "Vul een contactpersoon in."),
    qualificationIds: z.array(z.string().uuid()).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.startTime >= value.endTime) {
      ctx.addIssue({
        code: "custom",
        message: "De eindtijd moet na de begintijd liggen.",
        path: ["endTime"],
      });
    }
    if (
      (value.payType === "fixed" || value.payType === "both") &&
      !value.payAmountEuro
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Vul het vaste bedrag in.",
        path: ["payAmountEuro"],
      });
    }
    if (
      (value.payType === "hourly" || value.payType === "both") &&
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
  });

  if (!parsed.success) {
    return initialError(parsed.error.issues[0]?.message ?? "Ongeldige invoer.");
  }

  const input = parsed.data;

  if (!orgContext.locations.some((location) => location.id === input.locationId)) {
    return initialError("Deze vestiging hoort niet bij jouw organisatie.");
  }

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      organization_id: orgContext.organization.id,
      location_id: input.locationId,
      created_by: profile.id,
      job_type: input.jobType,
      sport_id: input.sportId,
      title: input.title,
      description: input.description,
      starts_on: input.startsOn,
      start_time: input.startTime,
      end_time: input.endTime,
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
    })
    .select("id")
    .single();

  if (error || !job) {
    if (error?.code === "42501") {
      return initialError(
        "Opdracht plaatsen is geblokkeerd: het abonnement van deze vestiging is niet actief.",
      );
    }
    return initialError("Opdracht plaatsen is niet gelukt.");
  }

  if (input.qualificationIds.length > 0) {
    await supabase.from("job_requirements").insert(
      input.qualificationIds.map((qualificationId) => ({
        job_id: job.id,
        qualification_id: qualificationId,
      })),
    );
  }

  revalidatePath("/organisatie/opdrachten");
  redirect(`/organisatie/opdrachten/${job.id}`);
}

export async function closeJobAction(jobId: string): Promise<void> {
  const supabase = await createClient();

  if (!supabase) {
    return;
  }

  await supabase
    .from("jobs")
    .update({ status: "closed" })
    .eq("id", jobId)
    .eq("status", "open");

  revalidatePath("/organisatie/opdrachten");
  revalidatePath(`/organisatie/opdrachten/${jobId}`);
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

  const { error } = await supabase.rpc("apply_to_job", {
    p_job: jobId,
    p_message: message,
    p_availability_note: availabilityNote,
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

  const { error } = await supabase.rpc("select_candidate", {
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

  const { error } = await supabase.rpc("confirm_job", { p_job: jobId });

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
  const supabase = await createClient();

  if (!supabase) {
    return initialError("Je bent niet ingelogd.");
  }

  const jobId = String(formData.get("jobId") ?? "");
  const reason = String(formData.get("reason") ?? "");

  const { error } = await supabase.rpc("cancel_confirmed_job", {
    p_job: jobId,
    p_reason: reason,
  });

  if (error) {
    return initialError(rpcErrorMessage(error));
  }

  revalidatePath(`/opdrachten/${jobId}`);
  revalidatePath(`/organisatie/opdrachten/${jobId}`);
  return { error: null, success: "De opdracht is geannuleerd." };
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
  const supabase = await createClient();

  if (!supabase) {
    return initialError("Je bent niet ingelogd.");
  }

  const jobId = String(formData.get("jobId") ?? "");
  const rating = Number(formData.get("rating") ?? 0);

  const { error } = await supabase.rpc("submit_review", {
    p_job: jobId,
    p_rating: rating,
  });

  if (error) {
    return initialError(rpcErrorMessage(error));
  }

  revalidatePath(`/opdrachten/${jobId}`);
  revalidatePath(`/organisatie/opdrachten/${jobId}`);
  revalidatePath("/reviews");
  return { error: null, success: "Bedankt voor je beoordeling!" };
}
