/**
 * Zoek-, filter- en sorteerstatus van het kandidatenoverzicht.
 *
 * De status staat volledig in de URL, zodat terugnavigeren, verversen en
 * delen dezelfde zoekopdracht opleveren. Parameternamen zijn Nederlands en
 * botsen bewust niet met de reviewfilters (`stars`, `sort`) op het profiel.
 *
 * Alles wat uit de URL komt wordt hier gevalideerd; ongeldige waarden worden
 * genegeerd (en gemeld), nooit doorgegeven. De database valideert opnieuw.
 */

export const CANDIDATE_PAGE_SIZE = 20;
export const MAX_CANDIDATE_PAGE = 1000;
export const MAX_QUERY_LENGTH = 100;

export const CANDIDATE_SORTS = {
  match: { label: "Beste match", rpc: "match" },
  beoordeling: { label: "Hoogste beoordeling", rpc: "rating" },
  betrouwbaarheid: { label: "Hoogste betrouwbaarheid", rpc: "reliability" },
  ervaring: { label: "Meeste ervaring", rpc: "experience" },
  afstand: { label: "Kortste afstand", rpc: "distance" },
} as const;
export type CandidateSort = keyof typeof CANDIDATE_SORTS;

export const AVAILABILITY_FILTERS = {
  beschikbaar: { label: "Aantoonbaar beschikbaar", rpc: "available" },
  onbekend: { label: "Beschikbaarheid onbekend", rpc: "unknown" },
  niet: { label: "Niet beschikbaar", rpc: "unavailable" },
} as const;
export type AvailabilityFilter = keyof typeof AVAILABILITY_FILTERS;

export const RELATION_FILTERS = {
  poule: { label: "Mijn poule", rpc: "pool" },
  samengewerkt: { label: "Eerder mee samengewerkt", rpc: "worked" },
  gereageerd: { label: "Heeft gereageerd", rpc: "applied" },
  uitgenodigd: { label: "Uitgenodigd", rpc: "invited" },
} as const;
export type RelationFilter = keyof typeof RELATION_FILTERS;

export const MIN_RATING_OPTIONS = [3, 3.5, 4, 4.5] as const;
export const MIN_EXPERIENCE_OPTIONS = [1, 2, 3, 5, 10] as const;
export const MAX_DISTANCE_OPTIONS = [5, 10, 25, 50, 100] as const;
export const MIN_RELIABILITY_OPTIONS = [50, 70, 80, 90] as const;

export interface CandidateFilters {
  q: string | null;
  sport: string | null;
  lessonType: string | null;
  availability: AvailabilityFilter | null;
  minRating: number | null;
  includeUnrated: boolean;
  minExperience: number | null;
  maxDistance: number | null;
  relation: RelationFilter | null;
  minReliability: number | null;
  onlyMatching: boolean;
  sort: CandidateSort;
  page: number;
}

/** URL-parameternamen per filter. `job` en `location` zijn context. */
export const PARAM = {
  q: "q",
  sport: "sport",
  lessonType: "lesvorm",
  availability: "beschikbaarheid",
  minRating: "minSterren",
  includeUnrated: "metNieuw",
  minExperience: "minErvaring",
  maxDistance: "maxAfstand",
  relation: "relatie",
  minReliability: "minBetrouwbaarheid",
  onlyMatching: "alleenPassend",
  sort: "sorteer",
  page: "pagina",
} as const satisfies Record<keyof CandidateFilters, string>;

export const DEFAULT_FILTERS: CandidateFilters = {
  q: null,
  sport: null,
  lessonType: null,
  availability: null,
  minRating: null,
  includeUnrated: false,
  minExperience: null,
  maxDistance: null,
  relation: null,
  minReliability: null,
  onlyMatching: false,
  sort: "match",
  page: 1,
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RawParams = Record<string, string | string[] | undefined>;

function single(params: RawParams, name: string): string | null {
  const value = params[name];
  const first = Array.isArray(value) ? value[0] : value;
  if (first == null) return null;
  const trimmed = first.trim();
  return trimmed === "" ? null : trimmed;
}

function hasKey<T extends object>(record: T, key: string): key is Extract<keyof T, string> {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function fromOptions(value: string | null, options: readonly number[]): number | null | undefined {
  if (value == null) return null;
  const parsed = Number(value);
  return options.includes(parsed) ? parsed : undefined;
}

export interface ParsedCandidateFilters {
  filters: CandidateFilters;
  /** Parameters met een ongeldige waarde; die zijn genegeerd. */
  ignored: string[];
}

/**
 * Leest de filterstatus uit URL-parameters. `hasJob` bepaalt of het
 * beschikbaarheidsfilter zin heeft: beschikbaarheid hoort bij één opdracht.
 */
export function parseCandidateFilters(
  params: RawParams,
  { hasJob }: { hasJob: boolean },
): ParsedCandidateFilters {
  const ignored: string[] = [];
  const filters: CandidateFilters = { ...DEFAULT_FILTERS };

  const q = single(params, PARAM.q);
  if (q != null) {
    if (q.length > MAX_QUERY_LENGTH) ignored.push(PARAM.q);
    else filters.q = q;
  }

  for (const key of ["sport", "lessonType"] as const) {
    const value = single(params, PARAM[key]);
    if (value == null) continue;
    if (UUID.test(value)) filters[key] = value.toLowerCase();
    else ignored.push(PARAM[key]);
  }

  const availability = single(params, PARAM.availability);
  if (availability != null) {
    if (!hasKey(AVAILABILITY_FILTERS, availability) || !hasJob) ignored.push(PARAM.availability);
    else filters.availability = availability;
  }

  const relation = single(params, PARAM.relation);
  if (relation != null) {
    if (hasKey(RELATION_FILTERS, relation)) filters.relation = relation;
    else ignored.push(PARAM.relation);
  }

  const sort = single(params, PARAM.sort);
  if (sort != null) {
    if (hasKey(CANDIDATE_SORTS, sort)) filters.sort = sort;
    else ignored.push(PARAM.sort);
  }

  const numeric = [
    ["minRating", MIN_RATING_OPTIONS],
    ["minExperience", MIN_EXPERIENCE_OPTIONS],
    ["maxDistance", MAX_DISTANCE_OPTIONS],
    ["minReliability", MIN_RELIABILITY_OPTIONS],
  ] as const;
  for (const [key, options] of numeric) {
    const parsed = fromOptions(single(params, PARAM[key]), options);
    if (parsed === undefined) ignored.push(PARAM[key]);
    else filters[key] = parsed;
  }

  for (const key of ["includeUnrated", "onlyMatching"] as const) {
    const value = single(params, PARAM[key]);
    if (value == null) continue;
    if (value === "1") filters[key] = true;
    else ignored.push(PARAM[key]);
  }

  const page = single(params, PARAM.page);
  if (page != null) {
    const parsed = Number(page);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_CANDIDATE_PAGE) {
      filters.page = parsed;
    } else {
      ignored.push(PARAM.page);
    }
  }

  return { filters, ignored };
}

/** Aantal actieve filters (zonder sortering, pagina en context). */
export function activeFilterCount(filters: CandidateFilters): number {
  return [
    filters.q,
    filters.sport,
    filters.lessonType,
    filters.availability,
    filters.minRating,
    filters.minExperience,
    filters.maxDistance,
    filters.relation,
    filters.minReliability,
    filters.onlyMatching || null,
    filters.includeUnrated || null,
  ].filter((value) => value != null).length;
}

/** Zet filters terug naar URL-parameters; standaardwaarden blijven weg. */
export function candidateSearchParams(
  filters: CandidateFilters,
  context: { job?: string | null; location?: string | null } = {},
): URLSearchParams {
  const params = new URLSearchParams();
  if (context.job) params.set("job", context.job);
  if (context.location) params.set("location", context.location);
  if (filters.q) params.set(PARAM.q, filters.q);
  if (filters.sport) params.set(PARAM.sport, filters.sport);
  if (filters.lessonType) params.set(PARAM.lessonType, filters.lessonType);
  if (filters.availability) params.set(PARAM.availability, filters.availability);
  if (filters.minRating != null) params.set(PARAM.minRating, String(filters.minRating));
  if (filters.includeUnrated) params.set(PARAM.includeUnrated, "1");
  if (filters.minExperience != null) params.set(PARAM.minExperience, String(filters.minExperience));
  if (filters.maxDistance != null) params.set(PARAM.maxDistance, String(filters.maxDistance));
  if (filters.relation) params.set(PARAM.relation, filters.relation);
  if (filters.minReliability != null) params.set(PARAM.minReliability, String(filters.minReliability));
  if (filters.onlyMatching) params.set(PARAM.onlyMatching, "1");
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set(PARAM.sort, filters.sort);
  if (filters.page > 1) params.set(PARAM.page, String(filters.page));
  return params;
}

/** Alle parameters die het overzicht (en de terugknop van een profiel) kent. */
export const CANDIDATE_LIST_PARAMS = ["job", "location", ...Object.values(PARAM)];

/**
 * Neemt alleen bekende overzichtsparameters over, bijvoorbeeld om vanaf een
 * kandidaatprofiel naar dezelfde zoekopdracht terug te keren.
 */
export function pickCandidateListParams(params: RawParams): URLSearchParams {
  const result = new URLSearchParams();
  for (const name of CANDIDATE_LIST_PARAMS) {
    const value = single(params, name);
    if (value != null && value.length <= 200) result.set(name, value);
  }
  return result;
}

/** Argumenten voor `search_organization_candidates`. */
export function candidateSearchRpcArgs(
  filters: CandidateFilters,
  context: { organizationId: string; locationId: string | null; jobId: string | null },
) {
  return {
    p_organization: context.organizationId,
    p_location: context.locationId,
    p_job: context.jobId,
    p_query: filters.q,
    p_sport: filters.sport,
    p_lesson_type: filters.lessonType,
    p_availability:
      filters.availability && context.jobId
        ? AVAILABILITY_FILTERS[filters.availability].rpc
        : null,
    p_min_rating: filters.minRating,
    p_min_experience: filters.minExperience,
    p_max_distance: filters.maxDistance,
    p_relation: filters.relation ? RELATION_FILTERS[filters.relation].rpc : null,
    p_min_reliability: filters.minReliability,
    p_include_unrated: filters.includeUnrated,
    p_only_matching: filters.onlyMatching,
    p_sort: CANDIDATE_SORTS[filters.sort].rpc,
    p_limit: CANDIDATE_PAGE_SIZE,
    p_offset: (filters.page - 1) * CANDIDATE_PAGE_SIZE,
  };
}
