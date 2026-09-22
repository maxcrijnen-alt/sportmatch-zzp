import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Award,
  BriefcaseBusiness,
  MapPin,
  ShieldCheck,
  Star,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ReviewFilters } from "@/components/reviews/review-filters";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <div>
        <Link
          className="text-sm font-medium text-primary hover:underline"
          href={backHref}
        >
          {isOwnPreview ? "← Terug naar mijn profiel" : "← Terug naar kandidaten"}
        </Link>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <Avatar
              className="h-20 w-20 text-xl"
              name={candidate.full_name}
              src={candidate.avatar_url}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">
                    {candidate.full_name}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                    {age != null ? <span>{age} jaar</span> : null}
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
                <Badge variant={hasValidVog ? "success" : "warning"}>
                  <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                  {hasValidVog ? "VOG goedgekeurd" : "VOG niet goedgekeurd"}
                </Badge>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <Link
                  className="rounded-lg border border-border p-3 transition-colors hover:border-warning/60 hover:bg-warning/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  href="#reviews"
                >
                  <p className="text-xs text-muted-foreground">Beoordeling</p>
                  <p className="mt-1 flex items-center gap-1 text-base font-semibold">
                    <Star className="h-4 w-4 fill-warning text-warning" />
                    {stats?.avg_rating ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {stats?.review_count ?? 0} reviews bekijken
                  </p>
                </Link>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Betrouwbaarheid</p>
                  <p className="mt-1 text-base font-semibold">
                    {stats?.reliability_score != null
                      ? `${stats.reliability_score}%`
                      : "Nieuw"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {stats?.completed_count ?? 0} afgerond
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Reisafstand</p>
                  <p className="mt-1 text-base font-semibold">
                    {details.travel_distance_km != null
                      ? `${details.travel_distance_km} km`
                      : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Vanaf woonplaats
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-[1.35fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Over mij</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
                {details.work_experience?.trim() ||
                  "Deze instructeur heeft nog geen omschrijving toegevoegd."}
              </p>
            </CardContent>
          </Card>

          <Card className="scroll-mt-24" id="reviews">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ontvangen reviews</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
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
              {visibleReviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {reviews.length === 0
                    ? "Nog geen ontvangen reviews."
                    : "Geen reviews gevonden met deze filters."}
                </p>
              ) : (
                visibleReviews.map((review) => (
                  <div
                    className="rounded-lg border border-border p-3"
                    key={review.id}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-warning">
                        {"★".repeat(review.rating)}
                        <span className="text-muted-foreground/40">
                          {"★".repeat(5 - review.rating)}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(review.created_at)}
                      </span>
                    </div>
                    {review.job?.title ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {review.job.title}
                      </p>
                    ) : null}
                    {review.comment ? (
                      <p className="mt-2 text-sm leading-6">“{review.comment}”</p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Sporten & lesvormen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Sporten
                </p>
                <div className="flex flex-wrap gap-2">
                  {(sportNamesResult.data ?? []).length > 0 ? (
                    (sportNamesResult.data ?? []).map((sport) => (
                      <Badge key={sport.id} variant="outline">
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
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Lesvormen
                </p>
                <div className="flex flex-wrap gap-2">
                  {(lessonNamesResult.data ?? []).length > 0 ? (
                    (lessonNamesResult.data ?? []).map((lessonType) => (
                      <Badge key={lessonType.id} variant="muted">
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Diploma’s</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {(qualificationNamesResult.data ?? []).length > 0 ? (
                (qualificationNamesResult.data ?? []).map((qualification) => (
                  <div
                    className="flex items-start gap-2 border-b border-border py-3 last:border-b-0 first:pt-0"
                    key={qualification.id}
                  >
                    <Award className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{qualification.name}</p>
                      {qualification.description ? (
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {qualification.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nog geen diploma’s toegevoegd.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {!isOwnPreview && query.job ? (
        <div className="flex justify-end">
          <Link href={`/organisatie/opdrachten/${query.job}`}>
            <Button>Terug naar opdracht</Button>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
