import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function createClient() {
  const config = getSupabaseConfig();

  if (!config) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components kunnen geen cookies schrijven; de proxy ververst ze.
        }
      },
    },
  });
}

export async function requireClient() {
  const client = await createClient();

  if (!client) {
    throw new Error(
      "Supabase is niet geconfigureerd. Voeg NEXT_PUBLIC_SUPABASE_URL en een publishable key toe aan .env.local.",
    );
  }

  return client;
}
