import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { JobApplication } from "@/types/database";

/** Openstaande reacties per pagina in het Reacties-blok. */
export const APPLICATIONS_PAGE_SIZE = 20;
/** Ruim boven elk realistisch aantal; voorkomt absurde offsets in de URL. */
export const MAX_APPLICATIONS_PAGE = 5000;
/** Eigen parameter, los van `pagina` van de kandidatenzoektocht. */
export const APPLICATIONS_PAGE_PARAM = "reactiesPagina";

export interface ApplicationRow extends JobApplication {
  job: { id: string; title: string; starts_on: string; location_id: string } | null;
}

export interface ApplicationsPage {
  applications: ApplicationRow[];
  total: number;
  /** Werkelijke pagina; een te hoge pagina valt terug op de laatste. */
  page: number;
  pageCount: number;
  error: string | null;
}

export function parseApplicationsPage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_APPLICATIONS_PAGE ? parsed : 1;
}

/**
 * Eén pagina openstaande reacties op opdrachten van de organisatie, met een
 * exacte telling. Iedere response is begrensd tot één pagina, dus de
 * PostgREST-rijlimiet (`max_rows`) kan geen reacties laten verdwijnen.
 * Volgorde: nieuwste eerst, id als unieke tie-breaker voor stabiele pagina's.
 * RLS op job_applications blijft van toepassing (gewone client).
 */
export async function getApplicationsPage(
  supabase: SupabaseClient,
  context: { organizationId: string; locationId: string | null; jobId: string | null; page: number },
): Promise<ApplicationsPage> {
  const query = (head: boolean) => {
    let builder = supabase
      .from("job_applications")
      .select(
        "*, job:jobs!inner (id, title, starts_on, organization_id, location_id)",
        head ? { count: "exact", head: true } : undefined,
      )
      .eq("job.organization_id", context.organizationId)
      .eq("status", "pending");
    if (context.locationId) builder = builder.eq("job.location_id", context.locationId);
    if (context.jobId) builder = builder.eq("job_id", context.jobId);
    return builder;
  };

  const counted = await query(true);
  if (counted.error) {
    return { applications: [], total: 0, page: 1, pageCount: 1, error: counted.error.message };
  }
  const total = counted.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / APPLICATIONS_PAGE_SIZE));
  const page = Math.min(Math.max(1, context.page), pageCount);
  if (total === 0) return { applications: [], total, page, pageCount, error: null };

  const from = (page - 1) * APPLICATIONS_PAGE_SIZE;
  const { data, error } = await query(false)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + APPLICATIONS_PAGE_SIZE - 1);
  if (error) return { applications: [], total, page, pageCount, error: error.message };

  return {
    applications: (data as unknown as ApplicationRow[] | null) ?? [],
    total,
    page,
    pageCount,
    error: null,
  };
}
