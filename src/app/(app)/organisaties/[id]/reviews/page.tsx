import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Star } from "lucide-react";
import { ReviewFilters } from "@/components/reviews/review-filters";
import { Badge } from "@/components/ui/badge";
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
import { createClient } from "@/lib/supabase/server";
import type { Review } from "@/types/database";

export const metadata: Metadata = {
  title: "Sportschoolreviews",
};

interface OrganizationReviewRow extends Review {
  job: { title: string; organization_id: string } | null;
}

export default async function OrganizationReviewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ stars?: string; sort?: string }>;
}) {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile || !supabase) {
    redirect("/login");
  }

  const { id } = await params;
  const query = await searchParams;
  const [{ data: organization }, { data: reviewData }] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("reviews")
      .select("*, job:jobs!inner(title, organization_id)")
      .eq("job.organization_id", id)
      .eq("side", "instructor")
      .not("released_at", "is", null)
      .order("created_at", { ascending: false }),
  ]);

  if (!organization) {
    notFound();
  }

  const reviews =
    (reviewData as unknown as OrganizationReviewRow[] | null) ?? [];
  const { stars: reviewStars, sort: reviewSort } = parseReviewFilters(query);
  const visibleReviews = filterAndSortReviews(reviews, reviewStars, reviewSort);
  const average =
    reviews.length > 0
      ? (
          reviews.reduce((sum, review) => sum + review.rating, 0) /
          reviews.length
        ).toFixed(1)
      : null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <Link
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        href="/opdrachten"
      >
        <ArrowLeft className="h-4 w-4" />
        Terug naar opdrachten
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Reviews van {organization.name as string}
        </h1>
        <p className="text-sm text-muted-foreground">
          Vrijgegeven beoordelingen van instructeurs na afgeronde opdrachten.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Gemiddelde score</CardDescription>
            <CardTitle className="flex items-center gap-1 text-2xl">
              <Star className="h-5 w-5 fill-warning text-warning" />
              {average ?? "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ontvangen beoordelingen</CardDescription>
            <CardTitle className="text-2xl">{reviews.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ontvangen reviews</CardTitle>
          <CardDescription>
            Alleen beoordelingen die na de dubbele beoordeling zijn vrijgegeven.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ReviewFilters
            resetHref={`/organisaties/${id}/reviews`}
            sort={reviewSort}
            stars={reviewStars}
          />
          {visibleReviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {reviews.length === 0
                ? "Deze sportschool heeft nog geen vrijgegeven reviews."
                : "Geen reviews gevonden met deze filters."}
            </p>
          ) : (
            visibleReviews.map((review) => (
              <div
                className="flex items-start justify-between gap-4 rounded-lg border border-border p-3"
                key={review.id}
              >
                <div className="min-w-0">
                  <span className="text-warning">
                    {"★".repeat(review.rating)}
                    <span className="text-muted-foreground/40">
                      {"★".repeat(5 - review.rating)}
                    </span>
                  </span>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {review.job?.title} · {formatDate(review.created_at)}
                  </p>
                  {review.comment ? (
                    <p className="mt-2 text-sm leading-6">“{review.comment}”</p>
                  ) : null}
                </div>
                <Badge className="shrink-0" variant="muted">
                  Ontvangen
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
