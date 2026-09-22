import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSessionProfile } from "@/lib/auth/session";
import { formatDate } from "@/lib/labels";
import { getOrgContext } from "@/lib/org/context";
import { resolveLocationFilter } from "@/lib/org/location-filter";
import { createClient } from "@/lib/supabase/server";
import type { InstructorPublicStats, JobApplication } from "@/types/database";

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
  custom_lesson_type: string | null;
  location_id: string;
  starts_on: string;
  start_time: string;
  end_time: string;
}

interface CandidateMatch {
  userId: string;
  job: OpenJobRow;
  score: number;
  lessonTypeName: string;
  distanceKm: number | null;
  availability: "available" | "unknown";
  yearsExperience: number;
  requiredQualifications: number;
  isFirstJob: boolean;
}

function distanceInKm(
  from: { lat: number; lng: number } | null,
  to: { lat: number; lng: number } | null,
): number | null {
  if (!from || !to) return null;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latDelta = radians(to.lat - from.lat);
  const lngDelta = radians(to.lng - from.lng);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(radians(from.lat)) *
      Math.cos(radians(to.lat)) *
      Math.sin(lngDelta / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}


export default async function KandidatenPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string; job?: string }>;
}) {
  const profile = await getSessionProfile();
  const orgContext = await getOrgContext();
  const supabase = await createClient();

  if (!profile || !supabase) {
    redirect("/login");
  }

  if (!orgContext) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const selectedLocationId = await resolveLocationFilter(
    orgContext.locations,
    params.location,
  );
  const selectedLocation = orgContext.locations.find(
    (location) => location.id === selectedLocationId,
  );
  const selectedJobId = params.job ?? null;
  const candidateProfileHref = (instructorId: string) => {
    const candidateParams = new URLSearchParams();
    if (selectedJobId) candidateParams.set("job", selectedJobId);
    if (selectedLocationId) candidateParams.set("location", selectedLocationId);
    const query = candidateParams.toString();
    return `/organisatie/kandidaten/${instructorId}${query ? `?${query}` : ""}`;
  };
  const candidateReviewsHref = (instructorId: string) =>
    `${candidateProfileHref(instructorId)}#reviews`;

  let applicationsQuery = supabase
    .from("job_applications")
    .select("*, job:jobs!inner (id, title, starts_on, organization_id, location_id)")
    .eq("job.organization_id", orgContext.organization.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (selectedLocationId) {
    applicationsQuery = applicationsQuery.eq(
      "job.location_id",
      selectedLocationId,
    );
  }
  if (selectedJobId) {
    applicationsQuery = applicationsQuery.eq("job_id", selectedJobId);
  }

  let openJobsQuery = supabase
    .from("jobs")
    .select(
      "id,title,sport_id,lesson_type_id,custom_lesson_type,location_id,starts_on,start_time,end_time",
    )
    .eq("organization_id", orgContext.organization.id)
    .eq("status", "open");

  if (selectedLocationId) {
    openJobsQuery = openJobsQuery.eq("location_id", selectedLocationId);
  }
  if (selectedJobId) {
    openJobsQuery = openJobsQuery.eq("id", selectedJobId);
  }

  const [{ data }, priorResult, openJobsResult] = await Promise.all([
    applicationsQuery,
    supabase
      .from("job_confirmations")
      .select("instructor_id, job:jobs!inner(id,organization_id,location_id,status)")
      .eq("job.organization_id", orgContext.organization.id)
      .eq("job.status", "completed"),
    openJobsQuery,
  ]);

  const applications = (data as unknown as ApplicationRow[] | null) ?? [];

  const workedBeforeIds = Array.from(
    new Set(
      ((priorResult.data as unknown as { instructor_id: string; job: { location_id: string } | null }[] | null) ?? [])
        .filter((item) => !selectedLocationId || item.job?.location_id === selectedLocationId)
        .map((item) => item.instructor_id),
    ),
  );
  const openJobs = ((openJobsResult.data as OpenJobRow[] | null) ?? [])
    .filter((job) => !selectedLocationId || job.location_id === selectedLocationId);
  const selectedJob = selectedJobId
    ? openJobs.find((job) => job.id === selectedJobId) ?? null
    : null;
  const openSportIds = Array.from(new Set(openJobs.map((job) => job.sport_id)));
  const { data: matchingSports } = openSportIds.length
    ? await supabase
        .from("instructor_sports")
        .select("user_id,sport_id")
        .in("sport_id", openSportIds)
        .limit(100)
    : { data: [] };
  const appliedIds = new Set(applications.map((application) => application.instructor_id));
  const matchRows = ((matchingSports as { user_id: string; sport_id: string }[] | null) ?? [])
    .filter((item) => !appliedIds.has(item.user_id));
  const uniqueMatchIds = Array.from(new Set(matchRows.map((item) => item.user_id)));
  const vogChecks = await Promise.all(
    uniqueMatchIds.map(async (userId) => ({
      userId,
      result: await supabase.rpc("has_valid_vog", { target_user: userId }),
    })),
  );
  const validVogIds = vogChecks
    .filter((item) => item.result.data === true)
    .map((item) => item.userId);
  const instructorIds = Array.from(
    new Set([
      ...applications.map((application) => application.instructor_id),
      ...workedBeforeIds,
      ...validVogIds,
    ]),
  );

  const namesById = new Map<
    string,
    {
      name: string;
      avatar: string | null;
      cityId: string | null;
      onboardingCompleted: boolean;
      createdAt: string;
    }
  >();
  if (instructorIds.length > 0) {
    const { data: instructorProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, city_id, onboarding_completed, created_at")
      .in("id", instructorIds);
    for (const row of instructorProfiles ?? []) {
      namesById.set(row.id as string, {
        name: row.full_name as string,
        avatar: row.avatar_url as string | null,
        cityId: row.city_id as string | null,
        onboardingCompleted: row.onboarding_completed as boolean,
        createdAt: row.created_at as string,
      });
    }
  }

  const statsEntries = await Promise.all(
    instructorIds.map(async (instructorId) => {
      const { data: statsData } = await supabase.rpc("instructor_public_stats", {
        target: instructorId,
      });
      return [
        instructorId,
        ((statsData as InstructorPublicStats[] | null) ?? [])[0] ?? null,
      ] as const;
    }),
  );
  const statsById = new Map(statsEntries);

  const openJobIds = openJobs.map((job) => job.id);
  const locationIds = Array.from(new Set(openJobs.map((job) => job.location_id)));
  const candidateCityIds = Array.from(
    new Set(
      validVogIds
        .map((userId) => namesById.get(userId)?.cityId)
        .filter((cityId): cityId is string => Boolean(cityId)),
    ),
  );
  const [
    detailsResult,
    qualificationsResult,
    lessonSpecialtiesResult,
    availabilityRulesResult,
    availabilityExceptionsResult,
    requirementsResult,
    locationsResult,
    citiesResult,
    lessonTypesResult,
  ] = await Promise.all([
    validVogIds.length
      ? supabase
          .from("instructor_profiles")
          .select(
            "user_id, years_experience, travel_distance_km, work_experience, hourly_rate_cents",
          )
          .in("user_id", validVogIds)
      : Promise.resolve({ data: [] }),
    validVogIds.length
      ? supabase
          .from("instructor_qualifications")
          .select("user_id, qualification_id")
          .in("user_id", validVogIds)
      : Promise.resolve({ data: [] }),
    validVogIds.length
      ? supabase
          .from("instructor_lesson_types")
          .select("user_id, lesson_type_id")
          .in("user_id", validVogIds)
      : Promise.resolve({ data: [] }),
    validVogIds.length
      ? supabase
          .from("availability_rules")
          .select("user_id, weekday, start_time, end_time")
          .in("user_id", validVogIds)
      : Promise.resolve({ data: [] }),
    validVogIds.length
      ? supabase
          .from("availability_exceptions")
          .select("user_id, on_date, is_available")
          .in("user_id", validVogIds)
          .in("on_date", Array.from(new Set(openJobs.map((job) => job.starts_on))))
      : Promise.resolve({ data: [] }),
    openJobIds.length
      ? supabase
          .from("job_requirements")
          .select("job_id, qualification_id")
          .in("job_id", openJobIds)
      : Promise.resolve({ data: [] }),
    locationIds.length
      ? supabase
          .from("organization_locations")
          .select("id, city:cities(id, lat, lng)")
          .in("id", locationIds)
      : Promise.resolve({ data: [] }),
    candidateCityIds.length
      ? supabase
          .from("cities")
          .select("id, lat, lng")
          .in("id", candidateCityIds)
      : Promise.resolve({ data: [] }),
    supabase.from("lesson_types").select("id, name"),
  ]);

  type DetailRow = {
    user_id: string;
    years_experience: number;
    travel_distance_km: number;
    work_experience: string;
    hourly_rate_cents: number | null;
  };
  type AvailabilityRuleRow = {
    user_id: string;
    weekday: number;
    start_time: string;
    end_time: string;
  };
  const detailsById = new Map(
    ((detailsResult.data as DetailRow[] | null) ?? []).map((row) => [
      row.user_id,
      row,
    ]),
  );
  const qualificationsByUser = new Map<string, Set<string>>();
  for (const row of
    (qualificationsResult.data as
      | { user_id: string; qualification_id: string }[]
      | null) ?? []) {
    const current = qualificationsByUser.get(row.user_id) ?? new Set<string>();
    current.add(row.qualification_id);
    qualificationsByUser.set(row.user_id, current);
  }
  const lessonTypesByUser = new Map<string, Set<string>>();
  for (const row of
    (lessonSpecialtiesResult.data as
      | { user_id: string; lesson_type_id: string }[]
      | null) ?? []) {
    const current = lessonTypesByUser.get(row.user_id) ?? new Set<string>();
    current.add(row.lesson_type_id);
    lessonTypesByUser.set(row.user_id, current);
  }
  const rulesByUser = new Map<string, AvailabilityRuleRow[]>();
  for (const row of
    (availabilityRulesResult.data as AvailabilityRuleRow[] | null) ?? []) {
    rulesByUser.set(row.user_id, [...(rulesByUser.get(row.user_id) ?? []), row]);
  }
  const exceptionsByUserDate = new Map<string, boolean>();
  for (const row of
    (availabilityExceptionsResult.data as
      | { user_id: string; on_date: string; is_available: boolean }[]
      | null) ?? []) {
    exceptionsByUserDate.set(`${row.user_id}:${row.on_date}`, row.is_available);
  }
  const requirementsByJob = new Map<string, Set<string>>();
  for (const row of
    (requirementsResult.data as
      | { job_id: string; qualification_id: string }[]
      | null) ?? []) {
    const current = requirementsByJob.get(row.job_id) ?? new Set<string>();
    current.add(row.qualification_id);
    requirementsByJob.set(row.job_id, current);
  }
  const coordinatesByLocation = new Map<string, { lat: number; lng: number }>();
  for (const row of
    (locationsResult.data as
      | {
          id: string;
          city: { lat: number; lng: number } | null;
        }[]
      | null) ?? []) {
    if (row.city) coordinatesByLocation.set(row.id, row.city);
  }
  const coordinatesByCity = new Map(
    ((citiesResult.data as { id: string; lat: number; lng: number }[] | null) ?? [])
      .map((row) => [row.id, { lat: row.lat, lng: row.lng }] as const),
  );
  const lessonTypeNames = new Map(
    ((lessonTypesResult.data as { id: string; name: string }[] | null) ?? [])
      .map((row) => [row.id, row.name] as const),
  );
  const sportsByUser = new Map<string, Set<string>>();
  for (const row of matchRows) {
    const current = sportsByUser.get(row.user_id) ?? new Set<string>();
    current.add(row.sport_id);
    sportsByUser.set(row.user_id, current);
  }
  const workedBeforeSet = new Set(workedBeforeIds);
  const candidateMatches: CandidateMatch[] = [];

  for (const userId of validVogIds) {
    if (appliedIds.has(userId)) continue;
    const details = detailsById.get(userId);
    const candidateProfile = namesById.get(userId);
    if (!details || !candidateProfile) continue;

    let bestMatch: CandidateMatch | null = null;
    for (const job of openJobs) {
      if (!sportsByUser.get(userId)?.has(job.sport_id)) continue;

      const lessonSpecialties = lessonTypesByUser.get(userId) ?? new Set<string>();
      if (
        job.lesson_type_id &&
        lessonSpecialties.size > 0 &&
        !lessonSpecialties.has(job.lesson_type_id)
      ) {
        continue;
      }

      const requirements = requirementsByJob.get(job.id) ?? new Set<string>();
      const qualifications = qualificationsByUser.get(userId) ?? new Set<string>();
      if ([...requirements].some((qualificationId) => !qualifications.has(qualificationId))) {
        continue;
      }

      const distanceKm = distanceInKm(
        candidateProfile.cityId
          ? coordinatesByCity.get(candidateProfile.cityId) ?? null
          : null,
        coordinatesByLocation.get(job.location_id) ?? null,
      );
      if (distanceKm != null && distanceKm > details.travel_distance_km) continue;

      const exception = exceptionsByUserDate.get(`${userId}:${job.starts_on}`);
      if (exception === false) continue;
      const availabilityRules = rulesByUser.get(userId) ?? [];
      const weekday = new Date(`${job.starts_on}T12:00:00Z`).getUTCDay();
      const fitsRule = availabilityRules.some(
        (rule) =>
          rule.weekday === weekday &&
          rule.start_time <= job.start_time &&
          rule.end_time >= job.end_time,
      );
      if (exception !== true && availabilityRules.length > 0 && !fitsRule) continue;
      const availability = exception === true || fitsRule ? "available" : "unknown";

      const stats = statsById.get(userId);
      const isFirstJob = !stats || Number(stats.review_count) === 0;
      const profileScore =
        (candidateProfile.onboardingCompleted ? 4 : 0) +
        (candidateProfile.avatar ? 2 : 0) +
        (details.work_experience.trim().length >= 40 ? 2 : 0) +
        (details.hourly_rate_cents != null ? 2 : 0);
      const score = Math.round(
        25 +
          (job.lesson_type_id && lessonSpecialties.has(job.lesson_type_id) ? 15 : 8) +
          (requirements.size > 0 ? 15 : 8) +
          (distanceKm == null
            ? 6
            : Math.max(0, 15 - (distanceKm / details.travel_distance_km) * 15)) +
          Math.min(details.years_experience, 10) +
          profileScore +
          (availability === "available" ? 8 : 4) +
          (isFirstJob
            ? 8
            : Math.min(10, (Number(stats?.avg_rating ?? 0) / 5) * 10)),
      );
      const match: CandidateMatch = {
        userId,
        job,
        score,
        lessonTypeName:
          job.custom_lesson_type ||
          (job.lesson_type_id ? lessonTypeNames.get(job.lesson_type_id) : null) ||
          "Algemene training",
        distanceKm,
        availability,
        yearsExperience: details.years_experience,
        requiredQualifications: requirements.size,
        isFirstJob,
      };
      if (!bestMatch || match.score > bestMatch.score) bestMatch = match;
    }
    if (bestMatch) candidateMatches.push(bestMatch);
  }

  candidateMatches.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    if (left.isFirstJob !== right.isFirstJob) return left.isFirstJob ? -1 : 1;
    return left.userId.localeCompare(right.userId);
  });
  const returningMatchesById = new Map(
    candidateMatches
      .filter((match) => workedBeforeSet.has(match.userId))
      .map((match) => [match.userId, match] as const),
  );
  const visibleCandidateMatches = candidateMatches
    .filter((match) => !workedBeforeSet.has(match.userId))
    .slice(0, 12);
  const highlyRatedMatches = candidateMatches
    .filter((match) => {
      const stats = statsById.get(match.userId);
      return Number(stats?.review_count ?? 0) > 0 && stats?.avg_rating != null;
    })
    .sort((left, right) => {
      const leftStats = statsById.get(left.userId);
      const rightStats = statsById.get(right.userId);
      const ratingDifference =
        Number(rightStats?.avg_rating ?? 0) - Number(leftStats?.avg_rating ?? 0);
      if (ratingDifference !== 0) return ratingDifference;
      return (
        Number(rightStats?.review_count ?? 0) -
        Number(leftStats?.review_count ?? 0)
      );
    })
    .slice(0, 6);

  const statsLine = (stats: InstructorPublicStats | null | undefined) => {
    if (!stats || stats.avg_rating == null || Number(stats.review_count) === 0) {
      return `Eerste klus · 0 reviews · Betrouwbaarheid ${stats?.reliability_score != null ? `${stats.reliability_score}%` : "Nieuw"}`;
    }

    return `★ ${stats.avg_rating} · ${stats.review_count} reviews · Betrouwbaarheid ${stats.reliability_score != null ? `${stats.reliability_score}%` : "Nieuw"} · ${stats.completed_count} afgerond`;
  };

  const candidateIdentity = (instructorId: string, subline?: string) => {
    const instructor = namesById.get(instructorId);
    const stats = statsById.get(instructorId);
    const hasReviews =
      Boolean(stats?.avg_rating != null) && Number(stats?.review_count ?? 0) > 0;

    return (
      <div className="flex min-w-0 items-center gap-3">
        <Link
          className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          href={candidateProfileHref(instructorId)}
        >
          <Avatar name={instructor?.name ?? "?"} src={instructor?.avatar} />
        </Link>
        <div className="min-w-0">
          <Link
            className="block truncate font-medium hover:text-primary"
            href={candidateProfileHref(instructorId)}
          >
            {instructor?.name}
          </Link>
          {hasReviews ? (
            <Link
              className="mt-0.5 block w-fit text-xs text-muted-foreground transition-colors hover:text-warning hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              href={candidateReviewsHref(instructorId)}
            >
              {statsLine(stats)}
            </Link>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {statsLine(stats)}
            </p>
          )}
          {subline ? (
            <p className="mt-1 text-xs text-muted-foreground">{subline}</p>
          ) : null}
        </div>
      </div>
    );
  };

  const sectionHeader = (title: string, count: number) => (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
      <h2 className="font-semibold">{title}</h2>
      <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
        {count}
      </span>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {selectedJob ? `Kandidaten · ${selectedJob.title}` : "Kandidaten"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {selectedJob
              ? "Reacties en passende instructeurs voor deze opdracht."
              : `Alle openstaande reacties${selectedLocation ? ` · ${selectedLocation.name}` : ""}`}
          </p>
        </div>
        {selectedJob ? (
          <Link
            className="text-sm font-medium text-primary hover:underline"
            href={
              selectedLocationId
                ? `/organisatie/kandidaten?location=${selectedLocationId}`
                : "/organisatie/kandidaten"
            }
          >
            Alle kandidaten
          </Link>
        ) : null}
      </div>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        {sectionHeader("Reacties", applications.length)}
        {applications.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <Users className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nog geen openstaande reacties.
            </p>
            <Link href="/organisatie/opdrachten/nieuw">
              <Button size="sm" variant="outline">Nieuwe opdracht</Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {applications.map((application) => {
              return (
                <div
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  key={application.id}
                >
                  {candidateIdentity(
                    application.instructor_id,
                    application.job
                      ? `${application.job.title} · ${formatDate(application.job.starts_on)}`
                      : undefined,
                  )}
                  <div className="flex shrink-0 items-center gap-2">
                    <Link href={candidateProfileHref(application.instructor_id)}>
                      <Button size="sm" variant="outline">Profiel</Button>
                    </Link>
                    <Link href={`/organisatie/opdrachten/${application.job?.id}`}>
                      <Button size="sm">Reactie bekijken</Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        {sectionHeader("Eerder mee samengewerkt", workedBeforeIds.length)}
        {workedBeforeIds.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            Nog geen eerdere samenwerkingen in deze selectie.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {workedBeforeIds.map((instructorId) => {
              const returningMatch = returningMatchesById.get(instructorId);

              return (
                <div
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  key={instructorId}
                >
                  {candidateIdentity(
                    instructorId,
                    returningMatch ? `Past bij ${returningMatch.job.title}` : undefined,
                  )}
                  <div className="flex shrink-0 items-center gap-2">
                    <Link href={candidateProfileHref(instructorId)}>
                      <Button size="sm" variant="outline">Profiel</Button>
                    </Link>
                    {returningMatch ? (
                      <Link href={`/organisatie/opdrachten/${returningMatch.job.id}`}>
                        <Button size="sm">Opnieuw uitnodigen</Button>
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        {sectionHeader("Passende instructeurs", visibleCandidateMatches.length)}
        {visibleCandidateMatches.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            Geen extra passende instructeurs gevonden.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {visibleCandidateMatches.map((match) => {
              return (
                <div
                  className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
                  key={match.userId}
                >
                  {candidateIdentity(match.userId)}

                  <div className="min-w-0 flex-1 lg:text-right">
                    <div className="flex flex-wrap gap-1.5 lg:justify-end">
                      <Badge variant="accent">Match {match.score}</Badge>
                      <Badge variant="outline">{match.lessonTypeName}</Badge>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      VOG ✓ · {match.distanceKm == null ? "Afstand onbekend" : `${match.distanceKm} km`} · {match.yearsExperience} jaar ervaring · {match.availability === "available" ? "Beschikbaar" : "Beschikbaarheid onbekend"}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Link href={candidateProfileHref(match.userId)}>
                      <Button size="sm" variant="outline">Profiel</Button>
                    </Link>
                    <Link href={`/organisatie/opdrachten/${match.job.id}`}>
                      <Button size="sm">Uitnodigen</Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        {sectionHeader("Hoog beoordeeld", highlyRatedMatches.length)}
        {highlyRatedMatches.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            Nog geen passende instructeurs met ontvangen reviews.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {highlyRatedMatches.map((match) => {
              return (
                <div
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  key={match.userId}
                >
                  {candidateIdentity(
                    match.userId,
                    `${match.job.title} · ${match.lessonTypeName}`,
                  )}
                  <div className="flex shrink-0 items-center gap-2">
                    <Link href={candidateProfileHref(match.userId)}>
                      <Button size="sm" variant="outline">Profiel</Button>
                    </Link>
                    <Link href={`/organisatie/opdrachten/${match.job.id}`}>
                      <Button size="sm">Uitnodigen</Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
