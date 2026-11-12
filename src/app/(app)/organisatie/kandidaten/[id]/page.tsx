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
import { ChipList } from "@/components/ui/chip-list";
import { ReviewItem } from "@/components/reviews/review-item";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
import type { InstructorCandidateProfile, InstructorPublicStats, Review } from "@/types/database";

export const metadata: Metadata = {
  title: "Instructeursprofiel",
};

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
      .rpc("get_instructor_candidate_profile", { p_instructor: instructorId })
      .returns<InstructorCandidateProfile[]>()
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
  const age = details.age;
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

  const showReviewFilters =
    reviews.length > 1 || reviewStars != null || reviewSort !== "recent";

  return (
    <Page width="medium">
      <Link
        className="inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        href={backHref}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {isOwnPreview ? "Terug naar mijn profiel" : "Terug naar kandidaten"}
      </Link>

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar
              className="h-16 w-16 text-xl ring-4 ring-primary-soft sm:h-20 sm:w-20"
              name={candidate.full_name}
              size="xl"
              src={candidate.avatar_url}
            />
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  {candidate.full_name}
                </h1>
                <Badge variant={hasValidVog ? "success" : "warning"}>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {hasValidVog ? "VOG goedgekeurd" : "VOG niet goedgekeurd"}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
                {age != null ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Cake className="h-3.5 w-3.5" />
                    {age} jaar
                  </span>
                ) : null}
                {cityName ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {cityName}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1.5">
                  <BriefcaseBusiness className="h-3.5 w-3.5" />
                  {details.years_experience ?? 0} jaar ervaring
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 [&>*]:max-sm:flex-1">
            {!isOwnPreview && query.job ? (
              <Link
                href={`/organisatie/opdrachten/${query.job}`}
                className={buttonVariants({ size: "sm" })}
              >Terug naar opdracht</Link>
            ) : null}
            {!isOwnPreview && orgContext && sessionProfile.role === "organization" ? (
              <ConnectionButton
                expanded
                initialConnected={isConnected}
                instructorId={instructorId}
                key={`${instructorId}-${isConnected}`}
              />
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 divide-border overflow-hidden rounded-lg border border-border bg-subtle sm:grid-cols-4 sm:divide-x [&>*]:max-sm:border-border [&>*:nth-child(odd)]:max-sm:border-r [&>*:nth-child(-n+2)]:max-sm:border-b">
          <Link
            className="group px-3 py-2.5 transition-colors hover:bg-card focus-visible:bg-card focus-visible:outline-none"
            href="#reviews"
          >
            <p className="text-xs text-muted-foreground">Beoordeling</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-base font-semibold tabular-nums">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              {stats?.avg_rating ?? "—"}
              <span className="text-xs font-normal text-muted-foreground group-hover:text-primary">
                ({stats?.review_count ?? 0})
              </span>
            </p>
          </Link>
          <div className="px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Betrouwbaarheid</p>
            <p className="mt-0.5 text-base font-semibold tabular-nums">
              {stats?.reliability_score != null
                ? `${stats.reliability_score}%`
                : "Nieuw"}
            </p>
          </div>
          <div className="px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Afgerond via SportMatch</p>
            <p className="mt-0.5 text-base font-semibold tabular-nums">
              {stats?.completed_count ?? 0}
            </p>
          </div>
          <div className="px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Reisafstand</p>
            <p className="mt-0.5 text-base font-semibold tabular-nums">
              {details.travel_distance_km != null
                ? `${details.travel_distance_km} km`
                : "—"}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-6">
        <div className="space-y-4 lg:space-y-6">
          <Panel>
            <PanelHeader icon={UserRound} title="Over mij" />
            <p className="whitespace-pre-line px-4 py-3.5 text-sm leading-6 text-foreground/85 sm:px-5">
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
            {showReviewFilters ? (
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
            ) : null}
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

        <div className="space-y-4 lg:space-y-6">
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
                  <div className="flex items-start gap-2.5 px-4 py-2.5 sm:px-5" key={qualification.id}>
                    <Award className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-5">{qualification.name}</p>
                      {qualification.description ? (
                        <p
                          className="line-clamp-1 text-xs leading-5 text-muted-foreground"
                          title={qualification.description}
                        >
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
            <PanelHeader as="h3" icon={Dumbbell} title="Sporten & lesvormen" />
            <div className="space-y-4 px-4 py-4 sm:px-5">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Sporten
                </p>
                <ChipList
                  items={sportNames.map(({ id, name }) => ({ id, name }))}
                  limit={10}
                  variant="default"
                />
              </div>
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Lesvormen
                </p>
                <ChipList
                  items={lessonNames.map(({ id, name }) => ({ id, name }))}
                  limit={8}
                />
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </Page>
  );
}
