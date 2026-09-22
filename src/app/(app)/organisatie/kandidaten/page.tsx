import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

const candidateReviewTips = [
  "Vergelijk eerst beschikbaarheid, tarief en afstand voor de specifieke opdracht.",
  "Gebruik badges, betrouwbaarheid en berichttekst als extra vertrouwen voordat je bevestigt.",
  "Open de opdracht om de kandidaat in context te bekijken en de volgende stap te nemen.",
];

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

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {selectedJob ? `Kandidaten · ${selectedJob.title}` : "Kandidaten"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {selectedJob
              ? "Reacties en passende instructeurs voor deze opdracht."
              : `Alle openstaande reacties op jullie opdrachten, klaar om te vergelijken${selectedLocation ? ` voor ${selectedLocation.name}` : ""}.`}
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

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-5">
          <p className="text-sm font-medium text-primary">
            Zo kies je sneller de juiste instructeur
          </p>
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {candidateReviewTips.map((tip) => (
              <p
                className="flex gap-2 rounded-md border border-border bg-background p-3 text-sm leading-6"
                key={tip}
              >
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                <span>{tip}</span>
              </p>
            ))}
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Eerder mee samengewerkt</h2>
          <p className="text-sm text-muted-foreground">Instructeurs met een succesvol afgeronde opdracht bij jullie sportschool.</p>
        </div>
        {workedBeforeIds.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Nog geen eerdere samenwerkingen in deze selectie.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {workedBeforeIds.map((instructorId) => {
              const instructor = namesById.get(instructorId);
              const stats = statsById.get(instructorId);
              const returningMatch = returningMatchesById.get(instructorId);
              return (
                <Card key={instructorId}>
                  <CardContent className="space-y-3 pt-5">
                    <div className="flex items-center gap-3">
                      <Avatar name={instructor?.name ?? "?"} src={instructor?.avatar} />
                      <div>
                        <p className="font-medium">{instructor?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {stats?.avg_rating != null ? `★ ${stats.avg_rating} · ` : ""}
                          {stats?.review_count ?? 0} reviews · {stats?.completed_count ?? 0} afgerond
                        </p>
                      </div>
                    </div>
                    {returningMatch ? (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Past bij {returningMatch.job.title}.
                        </p>
                        <Link href={`/organisatie/opdrachten/${returningMatch.job.id}`}>
                          <Button size="sm" variant="outline">
                            Opnieuw uitnodigen
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Momenteel geen passende open opdracht om voor uit te nodigen.
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div><h2 className="text-lg font-semibold">Reacties</h2><p className="text-sm text-muted-foreground">Instructeurs die daadwerkelijk op een open opdracht hebben gereageerd.</p></div>
      {applications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Users className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Nog geen openstaande reacties</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Plaats of verbeter je opdracht. Duidelijke tijden, vergoeding,
                locatie en kwalificaties maken reageren makkelijker.
              </p>
            </div>
            <Link href="/organisatie/opdrachten/nieuw">
              <Button variant="outline">Nieuwe opdracht</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {applications.map((application) => {
            const instructor = namesById.get(application.instructor_id);
            const stats = statsById.get(application.instructor_id);

            return (
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"
                key={application.id}
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    name={instructor?.name ?? "?"}
                    src={instructor?.avatar}
                  />
                  <div>
                    <p className="font-medium">{instructor?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Voor:{" "}
                      <Link
                        className="text-primary hover:underline"
                        href={`/organisatie/opdrachten/${application.job?.id}`}
                      >
                        {application.job?.title}
                      </Link>{" "}
                      · {application.job ? formatDate(application.job.starts_on) : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {stats?.avg_rating != null ? (
                    <Badge variant="accent">★ {stats.avg_rating}</Badge>
                  ) : (
                    <Badge variant="muted">Eerste klus</Badge>
                  )}
                  {stats && stats.reliability_score != null ? (
                    <Badge variant="outline">
                      Betrouwbaarheid {stats.reliability_score}%
                    </Badge>
                  ) : null}
                  {stats ? <Badge variant="outline">{stats.review_count} reviews · {stats.completed_count} afgerond</Badge> : null}
                  <Link href={`/organisatie/opdrachten/${application.job?.id}`}>
                    <Button size="sm" variant="outline">
                      Bekijken
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </section>

      <section className="space-y-3">
        <div><h2 className="text-lg font-semibold">Passende instructeurs</h2><p className="text-sm text-muted-foreground">Nog niet gereageerd, passend op sport, lesvorm, diploma&apos;s, VOG, afstand en eventuele beschikbaarheid. Een leeg beschikbaarheidsschema sluit niemand uit.</p></div>
        {visibleCandidateMatches.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Geen extra passende instructeurs gevonden.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {visibleCandidateMatches.map((match) => {
              const instructor = namesById.get(match.userId);
              const stats = statsById.get(match.userId);
              return (
                <Card key={match.userId}><CardContent className="space-y-3 pt-5">
                  <div className="flex items-center gap-3"><Avatar name={instructor?.name ?? "?"} src={instructor?.avatar} /><div><p className="font-medium">{instructor?.name}</p>{match.isFirstJob ? <Badge variant="muted">Eerste klus</Badge> : <p className="text-xs text-muted-foreground">★ {stats?.avg_rating} · {stats?.review_count} reviews · {stats?.completed_count} afgerond</p>}</div></div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="accent">Match {match.score}</Badge>
                    <Badge variant="outline">{match.lessonTypeName}</Badge>
                    <Badge variant="outline">VOG goedgekeurd</Badge>
                    <Badge variant="outline">
                      {match.distanceKm == null ? "Afstand onbekend" : `${match.distanceKm} km`}
                    </Badge>
                    <Badge variant="outline">{match.yearsExperience} jaar ervaring</Badge>
                    {match.requiredQualifications > 0 ? (
                      <Badge variant="outline">Diploma&apos;s compleet</Badge>
                    ) : null}
                    <Badge variant="outline">
                      {match.availability === "available"
                        ? "Beschikbaar volgens profiel"
                        : "Beschikbaarheid niet ingevuld"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Beste match voor {match.job.title}.
                  </p>
                  <Link href={`/organisatie/opdrachten/${match.job.id}`}><Button size="sm" variant="outline">Bekijken en uitnodigen</Button></Link>
                </CardContent></Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Hoog beoordeelde instructeurs</h2>
          <p className="text-sm text-muted-foreground">
            Passende instructeurs gerangschikt op echte beoordelingen en het
            aantal ontvangen reviews. Nieuwe instructeurs blijven hierboven
            zichtbaar als Eerste klus.
          </p>
        </div>
        {highlyRatedMatches.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            Nog geen passende instructeurs met ontvangen reviews.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {highlyRatedMatches.map((match) => {
              const instructor = namesById.get(match.userId);
              const stats = statsById.get(match.userId);
              return (
                <Card key={match.userId}>
                  <CardContent className="space-y-3 pt-5">
                    <div className="flex items-center gap-3">
                      <Avatar name={instructor?.name ?? "?"} src={instructor?.avatar} />
                      <div>
                        <p className="font-medium">{instructor?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          ★ {stats?.avg_rating} · {stats?.review_count} reviews · {stats?.completed_count} afgerond
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Past bij {match.job.title} · {match.lessonTypeName}
                    </p>
                    <Link href={`/organisatie/opdrachten/${match.job.id}`}>
                      <Button size="sm" variant="outline">
                        Bekijken en uitnodigen
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
