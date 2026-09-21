import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

function createAdminFetch(apiKey: string): typeof fetch {
  const baseFetch = fetch;

  return async (input, init) => {
    const headers = new Headers(init?.headers);

    // Modern Supabase secret keys authenticate through the `apikey` header and
    // are not JWTs. Some SDK requests still mirror the key into Authorization;
    // removing only that duplicate keeps PostgREST on the service_role path.
    if (
      apiKey.startsWith("sb_secret_") &&
      headers.get("Authorization") === `Bearer ${apiKey}`
    ) {
      headers.delete("Authorization");
    }

    return baseFetch(input, { ...init, headers });
  };
}

/**
 * Service-role client, uitsluitend voor servercode (seed-scripts, admin-acties
 * die RLS moeten omzeilen). Nooit importeren in clientcomponenten.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service-role configuratie ontbreekt.");
  }

  if (!adminClient) {
    adminClient = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        fetch: createAdminFetch(serviceRoleKey),
      },
    });
  }

  return adminClient;
}
