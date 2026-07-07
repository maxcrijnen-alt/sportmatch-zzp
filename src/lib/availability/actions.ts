"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export interface AvailabilityActionState {
  error: string | null;
}

const ruleSchema = z
  .object({
    weekday: z.coerce.number().int().min(0).max(6),
    startTime: z.string().min(1, "Kies een begintijd."),
    endTime: z.string().min(1, "Kies een eindtijd."),
  })
  .refine((value) => value.startTime < value.endTime, {
    message: "De eindtijd moet na de begintijd liggen.",
    path: ["endTime"],
  });

export async function addAvailabilityRuleAction(
  _previous: AvailabilityActionState,
  formData: FormData,
): Promise<AvailabilityActionState> {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile || !supabase) {
    return { error: "Je bent niet ingelogd." };
  }

  const parsed = ruleSchema.safeParse({
    weekday: formData.get("weekday"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer." };
  }

  const { error } = await supabase.from("availability_rules").insert({
    user_id: profile.id,
    weekday: parsed.data.weekday,
    start_time: parsed.data.startTime,
    end_time: parsed.data.endTime,
  });

  if (error) {
    return { error: "Opslaan is niet gelukt." };
  }

  revalidatePath("/beschikbaarheid");
  return { error: null };
}

export async function deleteAvailabilityRuleAction(ruleId: string): Promise<void> {
  const supabase = await createClient();

  if (!supabase) {
    return;
  }

  await supabase.from("availability_rules").delete().eq("id", ruleId);
  revalidatePath("/beschikbaarheid");
}

const exceptionSchema = z.object({
  onDate: z.string().min(1, "Kies een datum."),
  note: z.string().default(""),
});

export async function addAvailabilityExceptionAction(
  _previous: AvailabilityActionState,
  formData: FormData,
): Promise<AvailabilityActionState> {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile || !supabase) {
    return { error: "Je bent niet ingelogd." };
  }

  const parsed = exceptionSchema.safeParse({
    onDate: formData.get("onDate"),
    note: formData.get("note") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer." };
  }

  const { error } = await supabase.from("availability_exceptions").upsert(
    {
      user_id: profile.id,
      on_date: parsed.data.onDate,
      is_available: false,
      note: parsed.data.note,
    },
    { onConflict: "user_id,on_date" },
  );

  if (error) {
    return { error: "Opslaan is niet gelukt." };
  }

  revalidatePath("/beschikbaarheid");
  return { error: null };
}

export async function deleteAvailabilityExceptionAction(
  exceptionId: string,
): Promise<void> {
  const supabase = await createClient();

  if (!supabase) {
    return;
  }

  await supabase.from("availability_exceptions").delete().eq("id", exceptionId);
  revalidatePath("/beschikbaarheid");
}
