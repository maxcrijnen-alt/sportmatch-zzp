import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  candidateSearchRpcArgs,
  type CandidateFilters,
} from "@/lib/candidates/filters";

export type CandidateAvailability = "available" | "unknown" | "unavailable";

/** Eén rij uit `search_organization_candidates`. */
export interface CandidateSearchRow {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  city_name: string | null;
  years_experience: number;
  sport_ids: string[];
  lesson_type_ids: string[];
  has_valid_vog: boolean;
  avg_rating: number | string | null;
  review_count: number;
  completed_count: number;
  reliability_score: number | string | null;
  in_pool: boolean;
  worked_before: boolean;
  pending_application_job_id: string | null;
  invited_pending: boolean;
  action_job_id: string | null;
  applied_to_action_job: boolean;
  invited_to_action_job: boolean;
  match_job_id: string | null;
  match_score: number | null;
  availability: CandidateAvailability | null;
  distance_km: number | string | null;
  total_count: number;
  page_offset: number;
}

export interface Candidate {
  id: string;
  name: string;
  avatarUrl: string | null;
  city: string | null;
  yearsExperience: number;
  sportIds: string[];
  lessonTypeIds: string[];
  hasValidVog: boolean;
  /** `null` zolang er geen vrijgegeven reviews zijn; nooit 0. */
  avgRating: number | null;
  reviewCount: number;
  completedCount: number;
  /** `null` zonder bevestigde opdrachten; nooit 0. */
  reliability: number | null;
  inPool: boolean;
  workedBefore: boolean;
  pendingApplicationJobId: string | null;
  invitedPending: boolean;
  /** Opdracht waarvoor de uitnodigknop geldt (gekozen of best passend). */
  actionJobId: string | null;
  appliedToActionJob: boolean;
  invitedToActionJob: boolean;
  matchJobId: string | null;
  matchScore: number | null;
  availability: CandidateAvailability | null;
  /** `null` wanneer de woonplaats geen coördinaten heeft. */
  distanceKm: number | null;
}

export interface CandidateSearchResult {
  candidates: Candidate[];
  total: number;
  /** Werkelijke pagina (een te hoge pagina valt terug op de laatste). */
  page: number;
  pageCount: number;
  error: string | null;
}

const toNumber = (value: number | string | null): number | null =>
  value == null ? null : Number(value);

export async function searchCandidates(
  supabase: SupabaseClient,
  filters: CandidateFilters,
  context: { organizationId: string; locationId: string | null; jobId: string | null },
  pageSize: number,
): Promise<CandidateSearchResult> {
  const { data, error } = await supabase.rpc(
    "search_organization_candidates",
    candidateSearchRpcArgs(filters, context),
  );

  if (error) {
    return {
      candidates: [],
      total: 0,
      page: 1,
      pageCount: 1,
      error: error.message || "De kandidaten konden niet worden geladen.",
    };
  }

  const rows = (data as CandidateSearchRow[] | null) ?? [];
  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const offset = rows.length > 0 ? Number(rows[0].page_offset) : 0;

  return {
    candidates: rows.map((row) => ({
      id: row.user_id,
      name: row.full_name,
      avatarUrl: row.avatar_url,
      city: row.city_name,
      yearsExperience: row.years_experience,
      sportIds: row.sport_ids ?? [],
      lessonTypeIds: row.lesson_type_ids ?? [],
      hasValidVog: row.has_valid_vog,
      avgRating: Number(row.review_count) > 0 ? toNumber(row.avg_rating) : null,
      reviewCount: Number(row.review_count),
      completedCount: Number(row.completed_count),
      reliability: toNumber(row.reliability_score),
      inPool: row.in_pool,
      workedBefore: row.worked_before,
      pendingApplicationJobId: row.pending_application_job_id,
      invitedPending: row.invited_pending,
      actionJobId: row.action_job_id,
      appliedToActionJob: row.applied_to_action_job,
      invitedToActionJob: row.invited_to_action_job,
      matchJobId: row.match_job_id,
      matchScore: row.match_score,
      availability: row.availability,
      distanceKm: toNumber(row.distance_km),
    })),
    total,
    page: Math.floor(offset / pageSize) + 1,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    error: null,
  };
}

/** Samenvatting van een instructeur met een openstaande reactie. */
export interface ApplicantSummary {
  id: string;
  name: string;
  avatarUrl: string | null;
  /** `null` zolang er geen vrijgegeven reviews zijn; nooit 0. */
  avgRating: number | null;
  reviewCount: number;
  completedCount: number;
  /** `null` zonder bevestigde opdrachten; nooit 0. */
  reliability: number | null;
  inPool: boolean;
}

interface ApplicantSummaryRow {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  avg_rating: number | string | null;
  review_count: number;
  completed_count: number;
  reliability_score: number | string | null;
  in_pool: boolean;
}

/**
 * Statistieken voor alle instructeurs met een openstaande reactie, in één
 * aanroep (`organization_applicant_summaries`), ongeacht het aantal.
 */
export async function getApplicantSummaries(
  supabase: SupabaseClient,
  context: { organizationId: string; locationId: string | null; jobId: string | null },
): Promise<{ summaries: Map<string, ApplicantSummary>; error: string | null }> {
  const { data, error } = await supabase.rpc("organization_applicant_summaries", {
    p_organization: context.organizationId,
    p_location: context.locationId,
    p_job: context.jobId,
  });
  const summaries = new Map<string, ApplicantSummary>();
  if (error) return { summaries, error: error.message };

  for (const row of (data as ApplicantSummaryRow[] | null) ?? []) {
    summaries.set(row.user_id, {
      id: row.user_id,
      name: row.full_name,
      avatarUrl: row.avatar_url,
      avgRating: Number(row.review_count) > 0 ? toNumber(row.avg_rating) : null,
      reviewCount: Number(row.review_count),
      completedCount: Number(row.completed_count),
      reliability: toNumber(row.reliability_score),
      inPool: row.in_pool,
    });
  }
  return { summaries, error: null };
}
