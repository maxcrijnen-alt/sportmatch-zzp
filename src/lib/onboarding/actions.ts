"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export interface OnboardingActionState {
  error: string | null;
}

const instructorSchema = z
  .object({
    phone: z.string().min(8, "Vul een geldig telefoonnummer in."),
    cityId: z.string().uuid("Kies je woonplaats."),
    birthDate: z.string().min(1, "Vul je geboortedatum in."),
    yearsExperience: z.coerce.number().int().min(0).max(60),
    workExperience: z.string().max(2000).default(""),
    hourlyRateEuro: z.coerce
      .number()
      .min(1, "Vul een uurtarief in.")
      .max(500, "Vul een realistisch uurtarief in."),
    travelDistanceKm: z.coerce.number().int().min(1).max(250),
    statuses: z
      .array(z.enum(["zzp", "employee", "student", "job_seeker", "other"]))
      .min(1, "Kies minimaal één status."),
    sportIds: z.array(z.string().uuid()).min(1, "Kies minimaal één specialisatie."),
    kvkNumber: z.string().default(""),
    btwNumber: z.string().default(""),
  })
  .superRefine((value, ctx) => {
    if (value.statuses.includes("zzp") && value.kvkNumber.trim().length < 8) {
      ctx.addIssue({
        code: "custom",
        message: "Als zzp'er is een geldig KvK-nummer verplicht.",
        path: ["kvkNumber"],
      });
    }
  });

export async function completeInstructorOnboarding(
  _previous: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile || !supabase) {
    return { error: "Je bent niet ingelogd." };
  }

  const parsed = instructorSchema.safeParse({
    phone: formData.get("phone"),
    cityId: formData.get("cityId"),
    birthDate: formData.get("birthDate"),
    yearsExperience: formData.get("yearsExperience"),
    workExperience: formData.get("workExperience") ?? "",
    hourlyRateEuro: formData.get("hourlyRateEuro"),
    travelDistanceKm: formData.get("travelDistanceKm"),
    statuses: formData.getAll("statuses"),
    sportIds: formData.getAll("sportIds"),
    kvkNumber: formData.get("kvkNumber") ?? "",
    btwNumber: formData.get("btwNumber") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer." };
  }

  const input = parsed.data;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      phone: input.phone,
      city_id: input.cityId,
      onboarding_completed: true,
    })
    .eq("id", profile.id);

  if (profileError) {
    return { error: "Profiel opslaan is niet gelukt." };
  }

  const { error: instructorError } = await supabase
    .from("instructor_profiles")
    .upsert({
      user_id: profile.id,
      birth_date: input.birthDate,
      years_experience: input.yearsExperience,
      work_experience: input.workExperience,
      hourly_rate_cents: Math.round(input.hourlyRateEuro * 100),
      travel_distance_km: input.travelDistanceKm,
      kvk_number: input.kvkNumber.trim(),
      btw_number: input.btwNumber.trim(),
    });

  if (instructorError) {
    return { error: "Instructeursprofiel opslaan is niet gelukt." };
  }

  await supabase.from("instructor_statuses").delete().eq("user_id", profile.id);
  const { error: statusError } = await supabase
    .from("instructor_statuses")
    .insert(input.statuses.map((status) => ({ user_id: profile.id, status })));

  if (statusError) {
    return { error: "Statussen opslaan is niet gelukt." };
  }

  await supabase.from("instructor_sports").delete().eq("user_id", profile.id);
  const { error: sportsError } = await supabase
    .from("instructor_sports")
    .insert(input.sportIds.map((sportId) => ({ user_id: profile.id, sport_id: sportId })));

  if (sportsError) {
    return { error: "Specialisaties opslaan is niet gelukt." };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

const organizationSchema = z.object({
  name: z.string().min(2, "Vul de bedrijfsnaam in."),
  orgType: z.enum([
    "gym",
    "boutique_gym",
    "yoga_studio",
    "sports_club",
    "swimming_pool",
    "municipality",
    "hotel",
    "holiday_park",
    "events_organization",
  ]),
  kvkNumber: z.string().default(""),
  contactPhone: z.string().min(8, "Vul een telefoonnummer in."),
  locationName: z.string().min(2, "Vul de naam van de vestiging in."),
  street: z.string().min(2, "Vul de straat in."),
  houseNumber: z.string().min(1, "Vul het huisnummer in."),
  postalCode: z.string().min(6, "Vul een geldige postcode in."),
  cityId: z.string().uuid("Kies de plaats van de vestiging."),
});

export async function completeOrganizationOnboarding(
  _previous: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile || !supabase) {
    return { error: "Je bent niet ingelogd." };
  }

  const parsed = organizationSchema.safeParse({
    name: formData.get("name"),
    orgType: formData.get("orgType"),
    kvkNumber: formData.get("kvkNumber") ?? "",
    contactPhone: formData.get("contactPhone"),
    locationName: formData.get("locationName"),
    street: formData.get("street"),
    houseNumber: formData.get("houseNumber"),
    postalCode: formData.get("postalCode"),
    cityId: formData.get("cityId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer." };
  }

  const input = parsed.data;

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name: input.name,
      org_type: input.orgType,
      kvk_number: input.kvkNumber.trim(),
      contact_name: profile.full_name,
      contact_email: profile.email,
      contact_phone: input.contactPhone,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (orgError || !organization) {
    return { error: "Organisatie aanmaken is niet gelukt." };
  }

  const { error: memberError } = await supabase
    .from("organization_members")
    .insert({
      organization_id: organization.id,
      user_id: profile.id,
      member_role: "owner",
    });

  if (memberError) {
    return { error: "Lidmaatschap aanmaken is niet gelukt." };
  }

  const { error: locationError } = await supabase
    .from("organization_locations")
    .insert({
      organization_id: organization.id,
      name: input.locationName,
      street: input.street,
      house_number: input.houseNumber,
      postal_code: input.postalCode.toUpperCase().replace(/\s+/g, " "),
      city_id: input.cityId,
    });

  if (locationError) {
    return { error: "Vestiging aanmaken is niet gelukt." };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ phone: input.contactPhone, onboarding_completed: true })
    .eq("id", profile.id);

  if (profileError) {
    return { error: "Profiel bijwerken is niet gelukt." };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
