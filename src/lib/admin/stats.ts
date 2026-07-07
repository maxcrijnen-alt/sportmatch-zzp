import { createClient } from "@/lib/supabase/server";

export interface AdminStats {
  instructors: number;
  organizations: number;
  locations: number;
  jobsTotal: number;
  jobsOpen: number;
  jobsConfirmed: number;
  expiredDocuments: number;
  trials: number;
  activeSubscriptions: number;
}

export async function fetchAdminStats(): Promise<AdminStats | null> {
  const supabase = await createClient();

  if (!supabase) {
    return null;
  }

  const client = supabase;

  const count = async (table: string, statusEquals?: string) => {
    let query = client
      .from(table)
      .select("*", { count: "exact", head: true });
    if (statusEquals) {
      query = query.eq("status", statusEquals);
    }
    const { count: result } = await query;
    return result ?? 0;
  };

  const [
    instructors,
    organizations,
    locations,
    jobsTotal,
    jobsOpen,
    jobsConfirmed,
    expiredDocuments,
    trials,
    activeSubscriptions,
  ] = await Promise.all([
    count("instructor_profiles"),
    count("organizations"),
    count("organization_locations"),
    count("jobs"),
    count("jobs", "open"),
    count("jobs", "confirmed"),
    count("document_uploads", "expired"),
    count("subscriptions", "trial"),
    count("subscriptions", "active"),
  ]);

  return {
    instructors,
    organizations,
    locations,
    jobsTotal,
    jobsOpen,
    jobsConfirmed,
    expiredDocuments,
    trials,
    activeSubscriptions,
  };
}
