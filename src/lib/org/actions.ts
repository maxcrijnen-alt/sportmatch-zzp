"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSessionProfile } from "@/lib/auth/session";
import { getOrgContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";

export interface OrgActionState {
  error: string | null;
  success: string | null;
}

const fail = (message: string): OrgActionState => ({
  error: message,
  success: null,
});

const organizationSchema = z.object({
  name: z.string().min(2, "Vul de bedrijfsnaam in."),
  kvkNumber: z.string().default(""),
  contactName: z.string().min(2, "Vul een contactpersoon in."),
  contactEmail: z.string().email("Vul een geldig e-mailadres in."),
  contactPhone: z.string().min(8, "Vul een telefoonnummer in."),
  billingEmail: z.string().email().or(z.literal("")).default(""),
  billingReference: z.string().default(""),
});

export async function updateOrganizationAction(
  _previous: OrgActionState,
  formData: FormData,
): Promise<OrgActionState> {
  const orgContext = await getOrgContext();
  const supabase = await createClient();

  if (!orgContext || !supabase) {
    return fail("Geen organisatie gevonden.");
  }

  const parsed = organizationSchema.safeParse({
    name: formData.get("name"),
    kvkNumber: formData.get("kvkNumber") ?? "",
    contactName: formData.get("contactName"),
    contactEmail: formData.get("contactEmail"),
    contactPhone: formData.get("contactPhone"),
    billingEmail: formData.get("billingEmail") ?? "",
    billingReference: formData.get("billingReference") ?? "",
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Ongeldige invoer.");
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      name: parsed.data.name,
      kvk_number: parsed.data.kvkNumber.trim(),
      contact_name: parsed.data.contactName,
      contact_email: parsed.data.contactEmail,
      contact_phone: parsed.data.contactPhone,
      billing_email: parsed.data.billingEmail,
      billing_reference: parsed.data.billingReference,
    })
    .eq("id", orgContext.organization.id);

  if (error) {
    return fail("Opslaan is niet gelukt (alleen eigenaren kunnen dit wijzigen).");
  }

  revalidatePath("/organisatie");
  return { error: null, success: "Organisatie opgeslagen." };
}

const locationSchema = z.object({
  name: z.string().min(2, "Vul de naam van de vestiging in."),
  street: z.string().min(2, "Vul de straat in."),
  houseNumber: z.string().min(1, "Vul het huisnummer in."),
  postalCode: z.string().min(6, "Vul een geldige postcode in."),
  cityId: z.string().uuid("Kies een plaats."),
});

export async function addLocationAction(
  _previous: OrgActionState,
  formData: FormData,
): Promise<OrgActionState> {
  const orgContext = await getOrgContext();
  const supabase = await createClient();

  if (!orgContext || !supabase) {
    return fail("Geen organisatie gevonden.");
  }

  const parsed = locationSchema.safeParse({
    name: formData.get("name"),
    street: formData.get("street"),
    houseNumber: formData.get("houseNumber"),
    postalCode: formData.get("postalCode"),
    cityId: formData.get("cityId"),
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Ongeldige invoer.");
  }

  const { error } = await supabase.from("organization_locations").insert({
    organization_id: orgContext.organization.id,
    name: parsed.data.name,
    street: parsed.data.street,
    house_number: parsed.data.houseNumber,
    postal_code: parsed.data.postalCode.toUpperCase(),
    city_id: parsed.data.cityId,
  });

  if (error) {
    return fail(
      "Vestiging toevoegen is niet gelukt (alleen eigenaren kunnen dit).",
    );
  }

  revalidatePath("/organisatie/vestigingen");
  revalidatePath("/abonnement");
  return {
    error: null,
    success:
      "Vestiging toegevoegd. Er is automatisch een proefperiode van 30 dagen gestart.",
  };
}

const inviteSchema = z.object({
  email: z.string().email("Vul een geldig e-mailadres in."),
  memberRole: z.enum(["owner", "planner", "location_manager"]),
});

export async function inviteMemberAction(
  _previous: OrgActionState,
  formData: FormData,
): Promise<OrgActionState> {
  const orgContext = await getOrgContext();
  const supabase = await createClient();

  if (!orgContext || !supabase) {
    return fail("Geen organisatie gevonden.");
  }

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    memberRole: formData.get("memberRole"),
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Ongeldige invoer.");
  }

  const { error } = await supabase.from("organization_members").insert({
    organization_id: orgContext.organization.id,
    invited_email: parsed.data.email.toLowerCase(),
    member_role: parsed.data.memberRole,
    state: "invited",
  });

  if (error) {
    return fail("Uitnodigen is niet gelukt (alleen eigenaren kunnen dit).");
  }

  revalidatePath("/organisatie/medewerkers");
  return {
    error: null,
    success:
      "Uitnodiging klaargezet. Zodra de medewerker zich registreert of inlogt met dit e-mailadres, kan die de uitnodiging accepteren.",
  };
}

export async function removeMemberAction(memberId: string): Promise<void> {
  const supabase = await createClient();

  if (!supabase) {
    return;
  }

  await supabase.from("organization_members").delete().eq("id", memberId);
  revalidatePath("/organisatie/medewerkers");
}

export async function acceptOrgInviteAction(memberId: string): Promise<void> {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile || !supabase) {
    return;
  }

  await supabase
    .from("organization_members")
    .update({ user_id: profile.id, state: "active" })
    .eq("id", memberId);

  await supabase
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("id", profile.id);

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

const conversionFeeSchema = z.object({
  instructorId: z.string().uuid("Kies een instructeur."),
  note: z.string().default(""),
});

export async function reportConversionFeeAction(
  _previous: OrgActionState,
  formData: FormData,
): Promise<OrgActionState> {
  const profile = await getSessionProfile();
  const orgContext = await getOrgContext();
  const supabase = await createClient();

  if (!profile || !orgContext || !supabase) {
    return fail("Geen organisatie gevonden.");
  }

  const parsed = conversionFeeSchema.safeParse({
    instructorId: formData.get("instructorId"),
    note: formData.get("note") ?? "",
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Ongeldige invoer.");
  }

  const { error } = await supabase.from("conversion_fees").insert({
    organization_id: orgContext.organization.id,
    instructor_id: parsed.data.instructorId,
    reported_by: profile.id,
    note: parsed.data.note,
    status: "reported",
  });

  if (error) {
    return fail("Melden is niet gelukt.");
  }

  revalidatePath("/organisatie");
  return {
    error: null,
    success:
      "Bedankt voor je melding. De conversievergoeding van € 50 (excl. btw) wordt door de beheerder verwerkt.",
  };
}
