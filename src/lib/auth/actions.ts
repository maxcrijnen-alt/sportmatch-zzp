"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { DEMO_SESSION_COOKIE } from "@/lib/demo/constants";
import { cleanupDemoSession } from "@/lib/demo/factory";

const credentialsSchema = z.object({
  email: z.string().email("Vul een geldig e-mailadres in."),
  // Existing passwords remain valid when the creation policy becomes stricter.
  password: z.string().min(1, "Vul je wachtwoord in."),
});

const registerSchema = credentialsSchema.extend({
  password: z.string().min(8, "Wachtwoord moet minimaal 8 tekens zijn."),
  fullName: z.string().min(2, "Vul je naam in."),
  role: z.enum(["instructor", "organization"]),
});

export interface AuthActionState {
  error: string | null;
  success?: string;
}

const confirmationMessage = "Controleer je e-mail om je account te bevestigen. Heb je al een account? Log dan in of vraag een herstellink aan. Controleer ook je spamfolder.";

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

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/confirm?next=/onboarding`,
      data: {
        full_name: parsed.data.fullName,
        role: parsed.data.role,
      },
    },
  });

  if (error) {
    if (error.code === "user_already_exists") {
      return { error: null, success: confirmationMessage };
    }
    return { error: "Registreren is niet gelukt. Probeer het opnieuw." };
  }

  // Confirmation-enabled Auth returns a user but no authenticated session.
  // Do not send that visitor into protected onboarding or reveal duplicates.
  if (!data.session) {
    return { error: null, success: confirmationMessage };
  }

  revalidatePath("/", "layout");
  redirect("/onboarding");
}

export async function signOutAction(): Promise<void> {
  const cookieStore = await cookies();
  const demoSessionId = cookieStore.get(DEMO_SESSION_COOKIE)?.value;
  const supabase = await createClient();

  if (supabase && demoSessionId) {
    const { data: currentProfile } = await supabase
      .rpc("get_my_profile")
      .maybeSingle();
    const ownedDemoSessionId = (
      currentProfile as { demo_session_id?: string | null } | null
    )?.demo_session_id;
    if (ownedDemoSessionId === demoSessionId) {
      await cleanupDemoSession(demoSessionId).catch(() => undefined);
    }
  }
  if (supabase) {
    await supabase.auth.signOut();
  }
  if (demoSessionId) {
    cookieStore.delete(DEMO_SESSION_COOKIE);
  }

  revalidatePath("/", "layout");
  redirect("/");
}
