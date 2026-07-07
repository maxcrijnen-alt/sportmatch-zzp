import { createClient } from "@/lib/supabase/server";
import type { Job, OpenJobMatch } from "@/types/database";

export interface JobWithRelations extends Job {
  sport: { id: string; name: string } | null;
  location: {
    id: string;
    name: string;
    city: { id: string; name: string } | null;
  } | null;
  organization: { id: string; name: string; org_type: string } | null;
}

export const JOB_RELATIONS_SELECT = `
  *,
  sport:sports (id, name),
  location:organization_locations (id, name, city:cities (id, name)),
  organization:organizations (id, name, org_type)
`;

export async function fetchOpenJobsWithMatches(): Promise<{
  jobs: JobWithRelations[];
  matches: Map<string, OpenJobMatch>;
}> {
  const supabase = await createClient();

  if (!supabase) {
    return { jobs: [], matches: new Map() };
  }

  const [jobsResult, matchesResult] = await Promise.all([
    supabase
      .from("jobs")
      .select(JOB_RELATIONS_SELECT)
      .eq("status", "open")
      .gte("starts_on", new Date().toISOString().slice(0, 10))
      .order("starts_on"),
    supabase.rpc("open_job_matches"),
  ]);

  const matches = new Map<string, OpenJobMatch>(
    ((matchesResult.data as OpenJobMatch[] | null) ?? []).map((match) => [
      match.job_id,
      match,
    ]),
  );

  return {
    jobs: (jobsResult.data as unknown as JobWithRelations[] | null) ?? [],
    matches,
  };
}

export async function fetchJobWithRelations(
  jobId: string,
): Promise<JobWithRelations | null> {
  const supabase = await createClient();

  if (!supabase) {
    return null;
  }

  const { data } = await supabase
    .from("jobs")
    .select(JOB_RELATIONS_SELECT)
    .eq("id", jobId)
    .maybeSingle();

  return (data as unknown as JobWithRelations | null) ?? null;
}

export function describePay(job: Job): string {
  const euro = (cents: number) =>
    new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(
      cents / 100,
    );

  const parts: string[] = [];

  if (
    (job.pay_type === "fixed" || job.pay_type === "both") &&
    job.pay_amount_cents != null
  ) {
    parts.push(`${euro(job.pay_amount_cents)} vast`);
  }

  if (
    (job.pay_type === "hourly" || job.pay_type === "both") &&
    job.pay_hourly_rate_cents != null
  ) {
    parts.push(`${euro(job.pay_hourly_rate_cents)} per uur`);
  }

  if (parts.length === 0) {
    return "In overleg";
  }

  return parts.join(" of ") + (job.pay_is_negotiable ? " (onderhandelbaar)" : "");
}
