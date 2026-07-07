"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.string().email("Vul een geldig e-mailadres in."),
  password: z.string().min(8, "Wachtwoord moet minimaal 8 tekens zijn."),
});

const registerSchema = credentialsSchema.extend({
  fullName: z.string().min(2, "Vul je naam in."),
  role: z.enum(["instructor", "organization"]),
});

export interface AuthActionState {
  error: string | null;
}

export async function signInAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const supabase = await createClient();

  if (!supabase) {
    return { error: "Supabase is niet geconfigureerd." };
  }

  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer." };
  }

  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "Inloggen mislukt. Controleer je e-mailadres en wachtwoord." };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function registerAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const supabase = await createClient();

  if (!supabase) {
    return { error: "Supabase is niet geconfigureerd." };
  }

  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer." };
  }

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        role: parsed.data.role,
      },
    },
  });

  if (error) {
    if (error.code === "user_already_exists") {
      return { error: "Er bestaat al een account met dit e-mailadres." };
    }
    return { error: "Registreren is niet gelukt. Probeer het opnieuw." };
  }

  revalidatePath("/", "layout");
  redirect("/onboarding");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();

  if (supabase) {
    await supabase.auth.signOut();
  }

  revalidatePath("/", "layout");
  redirect("/");
}
