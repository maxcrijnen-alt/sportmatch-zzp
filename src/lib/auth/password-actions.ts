"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export interface PasswordActionState {
  error: string | null;
  success: string | null;
}

export async function requestPasswordResetAction(
  _previous: PasswordActionState,
  formData: FormData,
): Promise<PasswordActionState> {
  const supabase = await createClient();

  if (!supabase) {
    return { error: "Supabase is niet geconfigureerd.", success: null };
  }

  const email = z.string().email().safeParse(formData.get("email"));

  if (!email.success) {
    return { error: "Vul een geldig e-mailadres in.", success: null };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${appUrl}/auth/confirm?next=/wachtwoord-herstellen`,
  });

  // Altijd hetzelfde antwoord, ook bij onbekende adressen (privacy).
  return {
    error: null,
    success:
      "Als dit e-mailadres bekend is, hebben we een herstellink gestuurd. Check ook je spamfolder.",
  };
}

const newPasswordSchema = z
  .object({
    password: z.string().min(8, "Wachtwoord moet minimaal 8 tekens zijn."),
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    message: "De wachtwoorden komen niet overeen.",
    path: ["confirm"],
  });

export async function updatePasswordAction(
  _previous: PasswordActionState,
  formData: FormData,
): Promise<PasswordActionState> {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile || !supabase) {
    return {
      error: "De herstellink is verlopen. Vraag een nieuwe aan.",
      success: null,
    };
  }

  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Ongeldige invoer.",
      success: null,
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return {
      error: "Wachtwoord wijzigen is niet gelukt. Probeer het opnieuw.",
      success: null,
    };
  }

  redirect("/dashboard");
}
