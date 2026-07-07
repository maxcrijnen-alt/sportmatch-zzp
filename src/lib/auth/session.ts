import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

/**
 * Profiel van de ingelogde gebruiker, per request gecachet.
 * Geeft null terug als er geen sessie of geen Supabase-configuratie is.
 */
export const getSessionProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (profile as Profile | null) ?? null;
});
