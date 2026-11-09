import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Star } from "lucide-react";
import { ReviewFilters } from "@/components/reviews/review-filters";
import { ReviewItem } from "@/components/reviews/review-item";
import {
  Page,
  PageHeader,
  Panel,
  PanelEmpty,
  PanelHeader,
  PanelList,
} from "@/components/ui/page";
import { StatTile } from "@/components/ui/stat-tile";
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
    <Page width="narrow">
      <PageHeader
        back={{ href: "/opdrachten", label: "Terug naar opdrachten" }}
        title={`Reviews van ${organization.name as string}`}
      />

      <div className="grid grid-cols-2 gap-3">
        <StatTile
          icon={Star}
          label="Gemiddelde score"
          tone="warning"
          value={average ?? "—"}
        />
        <StatTile label="Ontvangen beoordelingen" value={reviews.length} />
      </div>

      <Panel>
        <PanelHeader
          count={reviews.length}
          description="Vrijgegeven beoordelingen van instructeurs na afgeronde opdrachten."
          title="Ontvangen reviews"
        />
        <div className="border-b border-border bg-subtle px-4 py-3 sm:px-5">
          <ReviewFilters
            resetHref={`/organisaties/${id}/reviews`}
            sort={reviewSort}
            stars={reviewStars}
          />
        </div>
        {visibleReviews.length === 0 ? (
          <PanelEmpty>
            {reviews.length === 0
              ? "Deze sportschool heeft nog geen vrijgegeven reviews."
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
    </Page>
  );
}
