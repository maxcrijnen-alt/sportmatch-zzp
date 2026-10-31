import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  WorkflowConfirmation,
  WorkflowSegmentConfirmation,
} from "./workflow";

/** Separate queries avoid ambiguous PostgREST relations through applications. */
export async function fetchJobConfirmations(jobIds: string[]) {
  const wholeByJob = new Map<string, WorkflowConfirmation[]>();
  const segmentsByJob = new Map<string, WorkflowSegmentConfirmation[]>();
  if (jobIds.length === 0) return { wholeByJob, segmentsByJob };
  const supabase = await createClient();
  if (!supabase)
    throw new Error("Bevestigingsstatussen konden niet worden geladen.");
  const [whole, segments] = await Promise.all([
    supabase
      .from("job_confirmations")
      .select("job_id, confirmed_at, organization_agreed_at")
      .in("job_id", jobIds),
    supabase
      .from("job_segment_confirmations")
      .select(
        "job_id, segment_id, confirmed_at, organization_agreed_at, cancelled_at",
      )
      .in("job_id", jobIds),
  ]);
  if (whole.error || segments.error) {
    throw new Error("Bevestigingsstatussen konden niet worden geladen.");
  }
  for (const row of whole.data ?? []) {
    wholeByJob.set(row.job_id, [...(wholeByJob.get(row.job_id) ?? []), row]);
  }
  for (const row of segments.data ?? []) {
    segmentsByJob.set(row.job_id, [
      ...(segmentsByJob.get(row.job_id) ?? []),
      row,
    ]);
  }
  return { wholeByJob, segmentsByJob };
}
