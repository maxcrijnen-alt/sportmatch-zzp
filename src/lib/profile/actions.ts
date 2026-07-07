"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export interface ProfileActionState {
  error: string | null;
  success: string | null;
}

const profileSchema = z.object({
  fullName: z.string().min(2, "Vul je naam in."),
  phone: z.string().min(8, "Vul een geldig telefoonnummer in."),
  cityId: z.string().uuid().nullable().or(z.literal("")),
});

export async function updateProfileAction(
  _previous: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile || !supabase) {
    return { error: "Je bent niet ingelogd.", success: null };
  }

  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    cityId: formData.get("cityId") ?? "",
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Ongeldige invoer.",
      success: null,
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
      city_id: parsed.data.cityId || null,
    })
    .eq("id", profile.id);

  if (error) {
    return { error: "Opslaan is niet gelukt.", success: null };
  }

  revalidatePath("/profiel");
  return { error: null, success: "Profiel opgeslagen." };
}

const instructorDetailsSchema = z.object({
  yearsExperience: z.coerce.number().int().min(0).max(60),
  workExperience: z.string().max(2000).default(""),
  hourlyRateEuro: z.coerce.number().min(1).max(500),
  travelDistanceKm: z.coerce.number().int().min(1).max(250),
  kvkNumber: z.string().default(""),
  btwNumber: z.string().default(""),
  statuses: z
    .array(z.enum(["zzp", "employee", "student", "job_seeker", "other"]))
    .min(1, "Kies minimaal één status."),
  sportIds: z.array(z.string().uuid()).min(1, "Kies minimaal één specialisatie."),
});

export async function updateInstructorDetailsAction(
  _previous: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile || !supabase) {
    return { error: "Je bent niet ingelogd.", success: null };
  }

  const parsed = instructorDetailsSchema.safeParse({
    yearsExperience: formData.get("yearsExperience"),
    workExperience: formData.get("workExperience") ?? "",
    hourlyRateEuro: formData.get("hourlyRateEuro"),
    travelDistanceKm: formData.get("travelDistanceKm"),
    kvkNumber: formData.get("kvkNumber") ?? "",
    btwNumber: formData.get("btwNumber") ?? "",
    statuses: formData.getAll("statuses"),
    sportIds: formData.getAll("sportIds"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Ongeldige invoer.",
      success: null,
    };
  }

  const input = parsed.data;

  if (input.statuses.includes("zzp") && input.kvkNumber.trim().length < 8) {
    return {
      error: "Als zzp'er is een geldig KvK-nummer verplicht.",
      success: null,
    };
  }

  const { error } = await supabase.from("instructor_profiles").upsert({
    user_id: profile.id,
    years_experience: input.yearsExperience,
    work_experience: input.workExperience,
    hourly_rate_cents: Math.round(input.hourlyRateEuro * 100),
    travel_distance_km: input.travelDistanceKm,
    kvk_number: input.kvkNumber.trim(),
    btw_number: input.btwNumber.trim(),
  });

  if (error) {
    return { error: "Opslaan is niet gelukt.", success: null };
  }

  await supabase.from("instructor_statuses").delete().eq("user_id", profile.id);
  await supabase
    .from("instructor_statuses")
    .insert(input.statuses.map((status) => ({ user_id: profile.id, status })));

  await supabase.from("instructor_sports").delete().eq("user_id", profile.id);
  await supabase
    .from("instructor_sports")
    .insert(
      input.sportIds.map((sportId) => ({ user_id: profile.id, sport_id: sportId })),
    );

  revalidatePath("/profiel");
  return { error: null, success: "Instructeursgegevens opgeslagen." };
}
