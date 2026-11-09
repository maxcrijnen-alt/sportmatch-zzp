import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Star } from "lucide-react";
import { PendingReviews } from "@/components/reviews/pending-reviews";
import { ReviewItem } from "@/components/reviews/review-item";
import { Badge } from "@/components/ui/badge";
import {
  Page,
  PageHeader,
  Panel,
  PanelEmpty,
  PanelHeader,
  PanelList,
} from "@/components/ui/page";
import { StatTile } from "@/components/ui/stat-tile";
import { TabLinks } from "@/components/ui/tabs";
import { getSessionProfile } from "@/lib/auth/session";
import { formatDate } from "@/lib/labels";
import { getOrgContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
import type { Review } from "@/types/database";

export const metadata: Metadata = {
  title: "Reviews",
};

interface ReviewRow extends Review {
  job: { title: string; organization_id: string } | null;
}

export default async function OrganisatieReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const profile = await getSessionProfile();
  const orgContext = await getOrgContext();
  const supabase = await createClient();
  const params = await searchParams;
  const activeView = params.view === "given" ? "given" : "received";

  if (!profile || !supabase) {
    redirect("/login");
  }

  if (!orgContext) {
    redirect("/dashboard");
  }

  const [
    { data: receivedData },
    { data: givenData },
    { data: completedJobs },
    { data: myReviews },
    { data: wholeConfirmations },
    { data: segmentConfirmations },
  ] = await Promise.all([
    supabase
      .from("reviews")
      .select("*, job:jobs!inner (title, organization_id)")
      .eq("job.organization_id", orgContext.organization.id)
      .eq("side", "instructor")
      .not("released_at", "is", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("reviews")
      .select("*, job:jobs!inner (title, organization_id)")
      .eq("job.organization_id", orgContext.organization.id)
      .eq("reviewer_id", profile.id)
      .eq("side", "organization")
      .order("created_at", { ascending: false }),
    supabase
      .from("jobs")
      .select("id,title,starts_on")
      .eq("organization_id", orgContext.organization.id)
      .eq("status", "completed"),
    supabase
      .from("reviews")
      .select("job_id, reviewee_id")
      .eq("reviewer_id", profile.id)
      .eq("side", "organization"),
    supabase
      .from("job_confirmations")
      .select("job_id, instructor_id, job:jobs!inner(organization_id,status)")
      .eq("job.organization_id", orgContext.organization.id)
      .eq("job.status", "completed")
      .not("confirmed_at", "is", null),
    supabase
      .from("job_segment_confirmations")
      .select("job_id, instructor_id, job:jobs!inner(organization_id,status)")
      .eq("job.organization_id", orgContext.organization.id)
      .eq("job.status", "completed")
      .not("confirmed_at", "is", null)
      .is("cancelled_at", null),
  ]);

  const receivedReviews =
    (receivedData as unknown as ReviewRow[] | null) ?? [];
  const givenReviews =
    (givenData as unknown as ReviewRow[] | null) ?? [];
  const average =
    receivedReviews.length > 0
      ? (
          receivedReviews.reduce((sum, review) => sum + review.rating, 0) /
          receivedReviews.length
        ).toFixed(1)
      : null;
  const reviewedPairs = new Set(
    myReviews?.map(
      (review) => `${review.job_id as string}:${review.reviewee_id as string}`,
    ) ?? [],
  );
  const expectedReviewees = new Map<string, Set<string>>();
  for (const confirmation of [
    ...(wholeConfirmations ?? []),
    ...(segmentConfirmations ?? []),
  ]) {
    const jobId = confirmation.job_id as string;
    const values = expectedReviewees.get(jobId) ?? new Set<string>();
    values.add(confirmation.instructor_id as string);
    expectedReviewees.set(jobId, values);
  }
  const pendingReviews = (completedJobs ?? []).filter(
    (job) =>
      Array.from(expectedReviewees.get(job.id as string) ?? []).some(
        (instructorId) =>
          !reviewedPairs.has(`${job.id as string}:${instructorId}`),
      ),
  );

  const visibleReviews =
    activeView === "received" ? receivedReviews : givenReviews;

  return (
    <Page width="narrow">
      <PageHeader title="Reviews" />

      {pendingReviews.length > 0 ? (
        <PendingReviews
          description="Rond deze beoordeling af voordat je een nieuwe opdracht plaatst of kandidaat kiest."
          items={pendingReviews.map((job) => ({
            id: job.id as string,
            title: job.title as string,
            href: `/organisatie/opdrachten/${job.id}`,
          }))}
        />
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <StatTile
          icon={Star}
          label="Gemiddelde ontvangen score"
          tone="warning"
          value={average ?? "—"}
        />
        <StatTile label="Beoordelingen" value={receivedReviews.length} />
      </div>

      <TabLinks
        fullWidth
        items={[
          {
            href: "/organisatie/reviews?view=received",
            label: "Ontvangen",
            count: receivedReviews.length,
            active: activeView === "received",
          },
          {
            href: "/organisatie/reviews?view=given",
            label: "Gegeven",
            count: givenReviews.length,
            active: activeView === "given",
          },
        ]}
        label="Reviewweergave"
      />

      <Panel>
        <PanelHeader
          description="Zichtbaar zodra beide partijen hebben beoordeeld."
          title={
            activeView === "received"
              ? "Ontvangen beoordelingen"
              : "Gegeven beoordelingen"
          }
        />
        {visibleReviews.length === 0 ? (
          <PanelEmpty>
            {activeView === "received"
              ? "Nog geen ontvangen beoordelingen."
              : "Nog geen beoordelingen gegeven."}
          </PanelEmpty>
        ) : (
          <PanelList>
            {visibleReviews.map((review) => (
              <ReviewItem
                aside={
                  activeView === "given" && !review.released_at ? (
                    <Badge variant="secondary">Wacht op tegenpartij</Badge>
                  ) : null
                }
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
