import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Gauge, Inbox, SearchX, Users } from "lucide-react";
import { CandidateCard } from "@/components/candidates/candidate-card";
import { CandidateFilters } from "@/components/candidates/candidate-filters";
import { CandidatePagination } from "@/components/candidates/candidate-pagination";
import { ConnectionButton } from "@/components/org/connection-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge, CountBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Page,
  PageHeader,
  Panel,
  PanelHeader,
  PanelList,
} from "@/components/ui/page";
import { Stars } from "@/components/ui/stars";
import { getSessionProfile } from "@/lib/auth/session";
import {
  activeFilterCount,
  CANDIDATE_PAGE_SIZE,
  candidateSearchParams,
  DEFAULT_FILTERS,
  parseCandidateFilters,
  RELATION_FILTERS,
  type CandidateFilters as Filters,
} from "@/lib/candidates/filters";
import { searchCandidates, type Candidate } from "@/lib/candidates/search";
import { formatDate } from "@/lib/labels";
import { getOrgContext } from "@/lib/org/context";
import { resolveLocationFilter } from "@/lib/org/location-filter";
import { createClient } from "@/lib/supabase/server";
import type { JobApplication } from "@/types/database";

export const metadata: Metadata = {
  title: "Kandidaten",
};

interface ApplicationRow extends JobApplication {
  job: { id: string; title: string; starts_on: string; location_id: string } | null;
}

interface OpenJobRow {
  id: string;
  title: string;
  sport_id: string;
  lesson_type_id: string | null;
  location_id: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Applicant summaries come from the same search, in bounded pages.
const MAX_APPLICANT_SUMMARY_PAGES = 10;

function formatRating(value: number) {
  return value.toLocaleString("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export default async function KandidatenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await getSessionProfile();
  const orgContext = await getOrgContext();
  const supabase = await createClient();

  if (!profile || !supabase) {
    redirect("/login");
  }

  if (!orgContext || profile.role !== "organization") {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const locationParam = typeof params.location === "string" ? params.location : undefined;
  const jobParam = typeof params.job === "string" && UUID.test(params.job) ? params.job : null;
  const selectedLocationId = await resolveLocationFilter(orgContext.locations, locationParam);
  const organizationId = orgContext.organization.id;

  let openJobsQuery = supabase
    .from("jobs")
    .select("id,title,sport_id,lesson_type_id,location_id")
    .eq("organization_id", organizationId)
    .eq("status", "open")
    .order("starts_on")
    .order("title");
  if (selectedLocationId) openJobsQuery = openJobsQuery.eq("location_id", selectedLocationId);

  let applicationsQuery = supabase
    .from("job_applications")
    .select("*, job:jobs!inner (id, title, starts_on, organization_id, location_id)")
    .eq("job.organization_id", organizationId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (selectedLocationId) applicationsQuery = applicationsQuery.eq("job.location_id", selectedLocationId);
  if (jobParam) applicationsQuery = applicationsQuery.eq("job_id", jobParam);

  const [openJobsResult, applicationsResult, sportsResult, lessonTypesResult] =
    await Promise.all([
      openJobsQuery,
      applicationsQuery,
      supabase.from("sports").select("id, name, is_active").order("name"),
      supabase
        .from("lesson_types")
        .select("id, name, sport_id, is_active, sort_order")
        .order("sort_order")
        .order("name"),
    ]);

  const openJobs = (openJobsResult.data as OpenJobRow[] | null) ?? [];
  const selectedJob = jobParam ? openJobs.find((job) => job.id === jobParam) ?? null : null;
  const selectedJobId = selectedJob?.id ?? null;
  const applications = (applicationsResult.data as unknown as ApplicationRow[] | null) ?? [];
  const sports = (sportsResult.data as { id: string; name: string; is_active: boolean }[] | null) ?? [];
  const lessonTypes =
    (lessonTypesResult.data as
      | { id: string; name: string; sport_id: string; is_active: boolean }[]
      | null) ?? [];

  const { filters, ignored } = parseCandidateFilters(params, { hasJob: Boolean(selectedJobId) });
  const searchContext = {
    organizationId,
    locationId: selectedLocationId,
    jobId: selectedJobId,
  };
  const result = await searchCandidates(supabase, filters, searchContext, CANDIDATE_PAGE_SIZE);
  const currentFilters: Filters = { ...filters, page: result.page };

  // Rating and reliability for the applications inbox, without per-row RPCs.
  const applicantSummaries = new Map<string, Candidate>();
  if (applications.length > 0) {
    for (let page = 1; page <= MAX_APPLICANT_SUMMARY_PAGES; page++) {
      const summary = await searchCandidates(
        supabase,
        { ...DEFAULT_FILTERS, relation: "gereageerd", page },
        searchContext,
        CANDIDATE_PAGE_SIZE,
      );
      if (summary.error || summary.page !== page) break;
      for (const candidate of summary.candidates) applicantSummaries.set(candidate.id, candidate);
      if (page >= summary.pageCount) break;
    }
  }
  const applicantProfiles = new Map<string, { name: string; avatar: string | null }>();
  const missingApplicantIds = Array.from(
    new Set(
      applications
        .map((application) => application.instructor_id)
        .filter((id) => !applicantSummaries.has(id)),
    ),
  );
  if (missingApplicantIds.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", missingApplicantIds);
    for (const row of data ?? []) {
      applicantProfiles.set(row.id as string, {
        name: row.full_name as string,
        avatar: row.avatar_url as string | null,
      });
    }
  }

  const sportNames = new Map(sports.map((sport) => [sport.id, sport.name]));
  const lessonTypeNames = new Map(lessonTypes.map((lessonType) => [lessonType.id, lessonType.name]));
  const jobTitles = new Map(openJobs.map((job) => [job.id, job.title]));
  const relevantSports = new Set<string>(
    [
      ...(selectedJob ? [selectedJob.sport_id] : openJobs.map((job) => job.sport_id)),
      filters.sport,
    ].filter((id): id is string => Boolean(id)),
  );
  const relevantLessonTypes = new Set<string>(
    [
      ...(selectedJob
        ? [selectedJob.lesson_type_id]
        : openJobs.map((job) => job.lesson_type_id)),
      filters.lessonType,
    ].filter((id): id is string => Boolean(id)),
  );

  const context = { job: selectedJobId, location: selectedLocationId };
  const listHref = (overrides: Partial<Filters> = {}) => {
    const query = candidateSearchParams({ ...currentFilters, ...overrides }, context).toString();
    return `/organisatie/kandidaten${query ? `?${query}` : ""}`;
  };
  const currentListQuery = candidateSearchParams(currentFilters, context).toString();
  const profileHref = (instructorId: string) =>
    `/organisatie/kandidaten/${instructorId}${currentListQuery ? `?${currentListQuery}` : ""}`;
  const resetHref = (() => {
    const query = candidateSearchParams(DEFAULT_FILTERS, context).toString();
    return `/organisatie/kandidaten${query ? `?${query}` : ""}`;
  })();
  const allCandidatesHref = (() => {
    // Availability belongs to one job, so it is dropped with the job.
    const query = candidateSearchParams(
      { ...currentFilters, availability: null, page: 1 },
      { location: selectedLocationId },
    ).toString();
    return `/organisatie/kandidaten${query ? `?${query}` : ""}`;
  })();
  const filterCount = activeFilterCount(filters);
  const firstShown = result.total === 0 ? 0 : (result.page - 1) * CANDIDATE_PAGE_SIZE + 1;
  const lastShown = Math.min(result.total, result.page * CANDIDATE_PAGE_SIZE);

  const relationLinks: { label: string; value: Filters["relation"] }[] = [
    { label: "Alle kandidaten", value: null },
    ...Object.entries(RELATION_FILTERS).map(([value, option]) => ({
      label: option.label,
      value: value as Filters["relation"],
    })),
  ];

  return (
    <Page>
      <PageHeader
        actions={
          selectedJob ? (
            <Link
              className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}
              href={allCandidatesHref}
            >
              Alle kandidaten
            </Link>
          ) : null
        }
        description="Zoek, vergelijk en nodig instructeurs uit. Iedere instructeur staat één keer in de lijst."
        title={selectedJob ? `Kandidaten · ${selectedJob.title}` : "Kandidaten"}
      />

      <nav
        aria-label="Kandidaatsecties"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {[
          { href: "#reacties", label: "Reacties", count: applications.length, icon: Inbox },
          { href: "#zoeken", label: "Kandidaten", count: result.total, icon: Users },
        ].map((item) => (
          <a
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-foreground shadow-xs transition-colors hover:border-border-strong hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              item.count === 0 && "border-dashed bg-transparent text-muted-foreground shadow-none",
            )}
            href={item.href}
            key={item.href}
          >
            <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
            {item.label}
            <CountBadge className="h-5 min-w-5 text-[11px]">{item.count}</CountBadge>
          </a>
        ))}
      </nav>

      <Panel className="scroll-mt-24" id="reacties">
        <PanelHeader
          count={applications.length}
          icon={Inbox}
          iconClassName="bg-orange-50 text-status-pending"
          title="Reacties"
        />
        {applications.length === 0 ? (
          <EmptyState
            action={
              <Link
                className={buttonVariants({ size: "sm", variant: "outline" })}
                href="/organisatie/opdrachten/nieuw"
              >
                Nieuwe opdracht
              </Link>
            }
            className="py-8"
            icon={Users}
            title="Nog geen openstaande reacties."
          />
        ) : (
          <PanelList>
            {applications.map((application) => {
              const summary = applicantSummaries.get(application.instructor_id);
              const fallback = applicantProfiles.get(application.instructor_id);
              const name = summary?.name ?? fallback?.name ?? "Instructeur";
              return (
                <div
                  className="grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)_auto] lg:items-center lg:gap-6"
                  key={application.id}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar
                      className={summary?.inPool ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : undefined}
                      name={name}
                      size="md"
                      src={summary?.avatarUrl ?? fallback?.avatar}
                    />
                    <div className="min-w-0">
                      <Link
                        className="block truncate text-sm font-semibold hover:text-primary"
                        href={profileHref(application.instructor_id)}
                      >
                        {name}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        {summary?.avgRating != null ? (
                          <span className="inline-flex items-center gap-1">
                            <Stars rating={summary.avgRating} size="xs" />
                            <span className="font-semibold text-foreground">
                              {formatRating(summary.avgRating)}
                            </span>
                            <span>({summary.reviewCount})</span>
                          </span>
                        ) : (
                          <Badge className="py-0 text-[11px]" variant="accent">
                            Eerste klus
                          </Badge>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Gauge aria-hidden="true" className="h-3 w-3" />
                          {summary?.reliability != null ? `${summary.reliability}%` : "Nieuw"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0 text-[13px] text-muted-foreground lg:border-l lg:border-border lg:pl-6">
                    {application.job ? (
                      <>
                        <p className="truncate font-medium text-foreground">{application.job.title}</p>
                        <p className="text-xs">{formatDate(application.job.starts_on)}</p>
                      </>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <Link
                      className={buttonVariants({ size: "sm" })}
                      href={`/organisatie/opdrachten/${application.job?.id}`}
                    >
                      <Inbox className="h-3.5 w-3.5" />
                      Reactie bekijken
                    </Link>
                    <ConnectionButton
                      initialConnected={summary?.inPool ?? false}
                      instructorId={application.instructor_id}
                      key={`${application.id}-${summary?.inPool ?? false}`}
                    />
                  </div>
                </div>
              );
            })}
          </PanelList>
        )}
      </Panel>

      <Panel className="scroll-mt-24" id="zoeken">
        <PanelHeader
          count={result.total}
          description="Op sport, lesvorm, diploma's, afstand, beschikbaarheid en reputatie."
          icon={Users}
          iconClassName="bg-accent text-accent-foreground"
          title="Kandidaten zoeken"
        />
        <div className="space-y-3 border-b border-border bg-subtle px-4 py-4 sm:px-5">
          <CandidateFilters
            filters={currentFilters}
            jobId={selectedJobId}
            lessonTypes={lessonTypes
              .filter((lessonType) => lessonType.is_active)
              .map((lessonType) => ({
                id: lessonType.id,
                name: lessonType.name,
                sportId: lessonType.sport_id,
              }))}
            locationId={selectedLocationId}
            openJobs={openJobs.map((job) => ({ id: job.id, title: job.title }))}
            resetHref={resetHref}
            sports={sports.filter((sport) => sport.is_active)}
          />

          <nav aria-label="Relatie met jouw sportschool" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {relationLinks.map((item) => {
              const active = filters.relation === item.value;
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center rounded-full border px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:h-8",
                    active
                      ? "border-primary bg-primary-soft text-primary-soft-foreground"
                      : "border-border bg-card text-foreground hover:border-border-strong",
                  )}
                  href={listHref({ relation: item.value, page: 1 })}
                  key={item.label}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {ignored.length > 0 ? (
          <div className="border-b border-border px-4 py-3 sm:px-5">
            <Alert variant="warning">
              <AlertDescription>
                {ignored.includes("beschikbaarheid") && !selectedJobId
                  ? "Beschikbaarheid hoort bij één opdracht: kies eerst een opdracht. "
                  : ""}
                Ongeldige filterwaarden zijn genegeerd.
              </AlertDescription>
            </Alert>
          </div>
        ) : null}
        {jobParam && !selectedJob ? (
          <div className="border-b border-border px-4 py-3 sm:px-5">
            <Alert variant="warning">
              <AlertDescription>
                Deze opdracht staat niet (meer) open in deze selectie. Je ziet
                kandidaten voor alle open opdrachten.
              </AlertDescription>
            </Alert>
          </div>
        ) : null}

        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-3 sm:px-5">
          <p aria-live="polite" className="text-sm font-medium" role="status">
            {result.total === 1
              ? "1 kandidaat gevonden"
              : `${result.total} kandidaten gevonden`}
            {filterCount > 0 ? (
              <span className="font-normal text-muted-foreground">
                {" "}
                · {filterCount} {filterCount === 1 ? "filter" : "filters"} actief
              </span>
            ) : null}
          </p>
          {result.total > 0 ? (
            <p className="text-xs text-muted-foreground">
              {firstShown}–{lastShown} van {result.total}
            </p>
          ) : null}
        </div>

        {result.error ? (
          <div className="px-4 pb-4 sm:px-5">
            <Alert variant="destructive">
              <AlertDescription>{result.error}</AlertDescription>
            </Alert>
          </div>
        ) : result.total === 0 ? (
          <EmptyState
            action={
              filterCount > 0 ? (
                <Link className={buttonVariants({ size: "sm", variant: "outline" })} href={resetHref}>
                  Filters wissen
                </Link>
              ) : undefined
            }
            className="py-10"
            description={
              filters.relation === "poule"
                ? "Nog geen instructeurs opgeslagen."
                : filterCount > 0
                  ? "Probeer minder of andere filters."
                  : "Instructeurs verschijnen hier zodra hun VOG is goedgekeurd of ze een relatie met jouw sportschool hebben."
            }
            icon={SearchX}
            title="Geen kandidaten gevonden"
          />
        ) : (
          <>
            <PanelList className="border-t border-border">
              {result.candidates.map((candidate) => (
                <CandidateCard
                  candidate={candidate}
                  jobTitles={jobTitles}
                  key={candidate.id}
                  lessonTypeNames={lessonTypeNames}
                  profileHref={profileHref(candidate.id)}
                  relevantLessonTypes={relevantLessonTypes}
                  relevantSports={relevantSports}
                  selectedJobId={selectedJobId}
                  sportNames={sportNames}
                />
              ))}
            </PanelList>
            <CandidatePagination
              hrefForPage={(page) => listHref({ page })}
              page={result.page}
              pageCount={result.pageCount}
            />
          </>
        )}
        <p className="border-t border-border px-4 py-3 text-xs leading-5 text-muted-foreground sm:px-5">
          De matchscore (0–100) is een indicatie op basis van sport, lesvorm,
          diploma&apos;s, afstand, beschikbaarheid, ervaring, profiel en reviews,
          geen voorspelde slagingskans. Nieuwe instructeurs zonder reviews krijgen
          een neutrale waardering, geen lage.
        </p>
      </Panel>
    </Page>
  );
}
