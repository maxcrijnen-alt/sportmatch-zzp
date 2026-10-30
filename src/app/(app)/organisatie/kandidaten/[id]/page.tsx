import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Award,
  BriefcaseBusiness,
  Cake,
  Dumbbell,
  MapPin,
  ShieldCheck,
  Star,
  UserRound,
} from "lucide-react";
import { ConnectionButton } from "@/components/org/connection-button";
import { ReviewFilters } from "@/components/reviews/review-filters";
import { ReviewItem } from "@/components/reviews/review-item";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Page,
  Panel,
  PanelEmpty,
  PanelHeader,
  PanelList,
} from "@/components/ui/page";
import { getSessionProfile } from "@/lib/auth/session";
import { formatDate } from "@/lib/labels";
import { filterAndSortReviews, parseReviewFilters } from "@/lib/reviews/filter";
import { getOrgContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
import type { InstructorPublicStats, Review } from "@/types/database";

export const metadata: Metadata = {
  title: "Instructeursprofiel",
};

function calculateAge(birthDate: string | null) {
  if (!birthDate) return null;

  const [year, month, day] = birthDate.split("-").map(Number);
  if (!year || !month || !day) return null;

  const nowParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());
  const now = Object.fromEntries(
    nowParts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  let age = now.year - year;
  if (now.month < month || (now.month === month && now.day < day)) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

export default async function CandidateProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ job?: string; location?: string; stars?: string; sort?: string }>;
}) {
  const sessionProfile = await getSessionProfile();
  const orgContext = await getOrgContext();
  const supabase = await createClient();

  if (!sessionProfile || !supabase) {
    redirect("/login");
  }

  const { id: instructorId } = await params;
  const query = await searchParams;
  const isOwnPreview =
    sessionProfile.role === "instructor" && instructorId === sessionProfile.id;

  if (!orgContext && !isOwnPreview) {
    redirect("/dashboard");
  }

  const [
    profileResult,
    detailsResult,
    sportsResult,
    lessonTypesResult,
    qualificationsResult,
    reviewsResult,
    statsResult,
    vogResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, role, full_name, avatar_url, city_id, custom_city")
      .eq("id", instructorId)
      .maybeSingle(),
    supabase
      .from("instructor_profiles")
      .select(
        "user_id, birth_date, work_experience, years_experience, hourly_rate_cents, travel_distance_km",
      )
      .eq("user_id", instructorId)
      .maybeSingle(),
    supabase
      .from("instructor_sports")
      .select("sport_id")
      .eq("user_id", instructorId),
    supabase
      .from("instructor_lesson_types")
      .select("lesson_type_id")
      .eq("user_id", instructorId),
    supabase
      .from("instructor_qualifications")
      .select("qualification_id")
      .eq("user_id", instructorId),
    supabase
      .from("reviews")
      .select("*, job:jobs(title)")
      .eq("reviewee_id", instructorId)
      .not("released_at", "is", null)
      .order("created_at", { ascending: false }),
    supabase.rpc("instructor_public_stats", { target: instructorId }),
    supabase.rpc("has_valid_vog", { target_user: instructorId }),
  ]);

  const candidate = profileResult.data;
  const details = detailsResult.data;

  if (!candidate || candidate.role !== "instructor" || !details) {
    notFound();
  }

  const connectionResult =
    orgContext && sessionProfile.role === "organization"
      ? await supabase
          .from("organization_instructor_connections")
          .select("instructor_id")
          .eq("organization_id", orgContext.organization.id)
          .eq("instructor_id", instructorId)
          .maybeSingle()
      : null;
  const isConnected = Boolean(connectionResult?.data);

  const sportIds = (sportsResult.data ?? []).map((item) => item.sport_id as string);
  const lessonTypeIds = (lessonTypesResult.data ?? []).map(
    (item) => item.lesson_type_id as string,
  );
  const qualificationIds = (qualificationsResult.data ?? []).map(
    (item) => item.qualification_id as string,
  );

  const [cityResult, sportNamesResult, lessonNamesResult, qualificationNamesResult] =
    await Promise.all([
      candidate.city_id
        ? supabase
            .from("cities")
            .select("name")
            .eq("id", candidate.city_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      sportIds.length
        ? supabase
            .from("sports")
            .select("id, name")
            .in("id", sportIds)
            .order("name")
        : Promise.resolve({ data: [] }),
      lessonTypeIds.length
        ? supabase
            .from("lesson_types")
            .select("id, name")
            .in("id", lessonTypeIds)
            .order("name")
        : Promise.resolve({ data: [] }),
      qualificationIds.length
        ? supabase
            .from("qualifications")
            .select("id, name, description")
            .in("id", qualificationIds)
            .order("name")
        : Promise.resolve({ data: [] }),
    ]);

  const stats =
    ((statsResult.data as InstructorPublicStats[] | null) ?? [])[0] ?? null;
  const reviews =
    (reviewsResult.data as unknown as (Review & {
      job: { title: string } | null;
    })[] | null) ?? [];
  const { stars: reviewStars, sort: reviewSort } = parseReviewFilters(query);
  const visibleReviews = filterAndSortReviews(reviews, reviewStars, reviewSort);
  const age = calculateAge(details.birth_date as string | null);
  const cityName =
    candidate.custom_city || (cityResult.data?.name as string | undefined) || null;
  const hasValidVog = vogResult.data === true;

  const backParams = new URLSearchParams();
  if (!isOwnPreview && query.job) backParams.set("job", query.job);
  if (!isOwnPreview && query.location) backParams.set("location", query.location);
  const backQuery = backParams.toString();
  const backHref = isOwnPreview
    ? "/profiel"
    : `/organisatie/kandidaten${backQuery ? `?${backQuery}` : ""}`;
  const reviewResetHref = `/organisatie/kandidaten/${instructorId}${backQuery ? `?${backQuery}` : ""}#reviews`;

  const sportNames = sportNamesResult.data ?? [];
  const lessonNames = lessonNamesResult.data ?? [];
  const qualificationNames = qualificationNamesResult.data ?? [];

  return (
    <Page width="medium">
      <Link
        className="inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        href={backHref}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {isOwnPreview ? "Terug naar mijn profiel" : "Terug naar kandidaten"}
      </Link>

      <Card className="overflow-hidden">
        <div
          aria-hidden="true"
          className="h-24 bg-[radial-gradient(120%_140%_at_0%_0%,rgb(5_150_105/0.16),transparent_60%),linear-gradient(135deg,var(--primary-soft),var(--subtle))] sm:h-28"
        />
        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
            <Avatar
              className="h-24 w-24 text-2xl ring-4 ring-card sm:h-28 sm:w-28"
              name={candidate.full_name}
              size="xl"
              src={candidate.avatar_url}
            />
            <div className="flex flex-wrap items-center gap-2 sm:pb-1">
              {!isOwnPreview && orgContext && sessionProfile.role === "organization" ? (
                <ConnectionButton
                  expanded
                  initialConnected={isConnected}
                  instructorId={instructorId}
                  key={`${instructorId}-${isConnected}`}
                />
              ) : null}
              {!isOwnPreview && query.job ? (
                <Link href={`/organisatie/opdrachten/${query.job}`}>
                  <Button size="sm">Terug naar opdracht</Button>
                </Link>
              ) : null}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
                {candidate.full_name}
              </h1>
              <Badge variant={hasValidVog ? "success" : "warning"}>
                <ShieldCheck className="h-3.5 w-3.5" />
                {hasValidVog ? "VOG goedgekeurd" : "VOG niet goedgekeurd"}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              {age != null ? (
                <span className="inline-flex items-center gap-1.5">
                  <Cake className="h-4 w-4" />
                  {age} jaar
                </span>
              ) : null}
              {cityName ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {cityName}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5">
                <BriefcaseBusiness className="h-4 w-4" />
                {details.years_experience ?? 0} jaar ervaring
              </span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 divide-x divide-border overflow-hidden rounded-xl border border-border bg-subtle">
            <Link
              className="group p-3 transition-colors hover:bg-card focus-visible:bg-card focus-visible:outline-none sm:p-4"
              href="#reviews"
            >
              <p className="text-xs text-muted-foreground">Beoordeling</p>
              <p className="mt-1 flex items-center gap-1.5 text-lg font-semibold tabular-nums">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                {stats?.avg_rating ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground group-hover:text-primary">
                {stats?.review_count ?? 0} reviews bekijken
              </p>
            </Link>
            <div className="p-3 sm:p-4">
              <p className="text-xs text-muted-foreground">Betrouwbaarheid</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {stats?.reliability_score != null
                  ? `${stats.reliability_score}%`
                  : "Nieuw"}
              </p>
              <p className="text-xs text-muted-foreground">
                {stats?.completed_count ?? 0} afgerond
              </p>
            </div>
            <div className="p-3 sm:p-4">
              <p className="text-xs text-muted-foreground">Reisafstand</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {details.travel_distance_km != null
                  ? `${details.travel_distance_km} km`
                  : "—"}
              </p>
              <p className="text-xs text-muted-foreground">Vanaf woonplaats</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-6">
          <Panel>
            <PanelHeader icon={UserRound} title="Over mij" />
            <p className="whitespace-pre-line px-4 py-4 text-sm leading-7 text-foreground/85 sm:px-5">
              {details.work_experience?.trim() ||
                "Deze instructeur heeft nog geen omschrijving toegevoegd."}
            </p>
          </Panel>

          <Panel className="scroll-mt-24" id="reviews">
            <PanelHeader
              count={reviews.length}
              icon={Star}
              iconClassName="bg-amber-50 text-amber-500"
              title="Ontvangen reviews"
            />
            <div className="border-b border-border bg-subtle px-4 py-3 sm:px-5">
              <ReviewFilters
                hiddenParams={
                  isOwnPreview
                    ? {}
                    : { job: query.job, location: query.location }
                }
                resetHref={reviewResetHref}
                sort={reviewSort}
                stars={reviewStars}
              />
            </div>
            {visibleReviews.length === 0 ? (
              <PanelEmpty>
                {reviews.length === 0
                  ? "Nog geen ontvangen reviews."
                  : "Geen reviews gevonden met deze filters."}
              </PanelEmpty>
            ) : (
              <PanelList>
                {visibleReviews.map((review) => (
                  <ReviewItem
                    comment={review.comment}
                    date={formatDate(review.created_at)}
                    key={review.id}
                    rating={review.rating}
                    subtitle={review.job?.title}
                  />
                ))}
              </PanelList>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel>
            <PanelHeader as="h3" icon={Dumbbell} title="Sporten & lesvormen" />
            <div className="space-y-4 px-4 py-4 sm:px-5">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Sporten
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {sportNames.length > 0 ? (
                    sportNames.map((sport) => (
                      <Badge key={sport.id} variant="default">
                        {sport.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Niet ingevuld
                    </span>
                  )}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Lesvormen
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {lessonNames.length > 0 ? (
                    lessonNames.map((lessonType) => (
                      <Badge key={lessonType.id} variant="outline">
                        {lessonType.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Niet ingevuld
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              as="h3"
              count={qualificationNames.length}
              icon={Award}
              title="Diploma’s"
            />
            {qualificationNames.length > 0 ? (
              <PanelList>
                {qualificationNames.map((qualification) => (
                  <div className="flex items-start gap-3 px-4 py-3 sm:px-5" key={qualification.id}>
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
                      <Award className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{qualification.name}</p>
                      {qualification.description ? (
                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                          {qualification.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </PanelList>
            ) : (
              <PanelEmpty>Nog geen diploma’s toegevoegd.</PanelEmpty>
            )}
          </Panel>

          <Panel>
            <PanelHeader as="h3" icon={BriefcaseBusiness} title="Werkervaring" />
            <dl className="divide-y divide-border text-sm">
              <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <dt className="text-muted-foreground">Ervaring</dt>
                <dd className="font-medium tabular-nums">
                  {details.years_experience ?? 0} jaar
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <dt className="text-muted-foreground">Afgerond via SportMatch</dt>
                <dd className="font-medium tabular-nums">{stats?.completed_count ?? 0}</dd>
              </div>
            </dl>
          </Panel>
        </div>
      </div>
    </Page>
  );
}
