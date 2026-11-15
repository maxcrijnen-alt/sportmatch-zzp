import { expect, test } from "@playwright/test";
import {
  activeFilterCount,
  candidateSearchParams,
  candidateSearchRpcArgs,
  DEFAULT_FILTERS,
  parseCandidateFilters,
  pickCandidateListParams,
} from "@/lib/candidates/filters";

// Pure parsing/serialisation; no browser or database needed.
const SPORT = "0b7c1d2e-3f40-4a5b-8c6d-7e8f9a0b1c2d";
const JOB = "11111111-2222-4333-8444-555555555555";
const ORG = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

test("geldige filters worden gelezen en zonder standaardwaarden teruggeschreven", () => {
  const { filters, ignored } = parseCandidateFilters(
    {
      q: "  Anna  ",
      sport: SPORT.toUpperCase(),
      beschikbaarheid: "onbekend",
      minSterren: "4.5",
      metNieuw: "1",
      minErvaring: "5",
      maxAfstand: "25",
      relatie: "poule",
      minBetrouwbaarheid: "80",
      alleenPassend: "1",
      sorteer: "afstand",
      pagina: "3",
    },
    { hasJob: true },
  );
  expect(ignored).toEqual([]);
  expect(filters).toMatchObject({
    q: "Anna",
    sport: SPORT,
    availability: "onbekend",
    minRating: 4.5,
    includeUnrated: true,
    minExperience: 5,
    maxDistance: 25,
    relation: "poule",
    minReliability: 80,
    onlyMatching: true,
    sort: "afstand",
    page: 3,
  });
  expect(activeFilterCount(filters)).toBe(10);

  const params = candidateSearchParams(filters, { job: JOB, location: null });
  expect(Object.fromEntries(params)).toEqual({
    job: JOB,
    q: "Anna",
    sport: SPORT,
    beschikbaarheid: "onbekend",
    minSterren: "4.5",
    metNieuw: "1",
    minErvaring: "5",
    maxAfstand: "25",
    relatie: "poule",
    minBetrouwbaarheid: "80",
    alleenPassend: "1",
    sorteer: "afstand",
    pagina: "3",
  });
  expect(candidateSearchParams(DEFAULT_FILTERS).toString()).toBe("");

  const args = candidateSearchRpcArgs(filters, { organizationId: ORG, locationId: null, jobId: JOB });
  expect(args).toMatchObject({
    p_organization: ORG,
    p_job: JOB,
    p_availability: "unknown",
    p_relation: "pool",
    p_sort: "distance",
    p_limit: 20,
    p_offset: 40,
  });
});

test("ongeldige en gemanipuleerde parameters worden genegeerd en gemeld", () => {
  const { filters, ignored } = parseCandidateFilters(
    {
      q: "x".repeat(101),
      sport: "1; drop table sports",
      lesvorm: "../../etc",
      beschikbaarheid: "beschikbaar",
      minSterren: "9",
      minErvaring: "-1",
      maxAfstand: "100000",
      relatie: "iedereen",
      minBetrouwbaarheid: "abc",
      metNieuw: "true",
      alleenPassend: "ja",
      sorteer: "name; drop",
      pagina: "-3",
    },
    { hasJob: false },
  );
  expect(filters).toEqual(DEFAULT_FILTERS);
  expect(ignored.sort()).toEqual(
    [
      "q", "sport", "lesvorm", "beschikbaarheid", "minSterren", "minErvaring", "maxAfstand",
      "relatie", "minBetrouwbaarheid", "metNieuw", "alleenPassend", "sorteer", "pagina",
    ].sort(),
  );
  // Availability only makes sense for one job and never reaches the RPC without it.
  const withAvailability = { ...DEFAULT_FILTERS, availability: "beschikbaar" as const };
  expect(
    candidateSearchRpcArgs(withAvailability, { organizationId: ORG, locationId: null, jobId: null })
      .p_availability,
  ).toBeNull();
  // Repeated parameters: only the first value counts.
  expect(parseCandidateFilters({ sorteer: ["ervaring", "drop"] }, { hasJob: false }).filters.sort)
    .toBe("ervaring");
  expect(parseCandidateFilters({ pagina: "1001" }, { hasJob: false }).ignored).toEqual(["pagina"]);
});

test("terugkeren naar het overzicht neemt alleen bekende parameters over", () => {
  const params = pickCandidateListParams({
    job: JOB,
    q: "Anna",
    pagina: "2",
    stars: "5",
    sort: "lowest",
    redirect: "https://evil.example",
  });
  expect(Object.fromEntries(params)).toEqual({ job: JOB, q: "Anna", pagina: "2" });
});
