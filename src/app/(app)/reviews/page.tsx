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
import { createClient } from "@/lib/supabase/server";
import type { InstructorPublicStats, Review } from "@/types/database";

export const metadata: Metadata = {
  title: "Reviews",
};

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const profile = await getSessionProfile();
  const supabase = await createClient();
  const params = await searchParams;
  const activeView = params.view === "given" ? "given" : "received";

  if (!profile || !supabase) {
    redirect("/login");
  }

  const [
    receivedResult,
    givenResult,
    statsResult,
    completedResult,
    completedSegmentsResult,
  ] = await Promise.all([
    supabase
      .from("reviews")
      .select("*, job:jobs (title)")
      .eq("reviewee_id", profile.id)
      .not("released_at", "is", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("reviews")
      .select("*, job:jobs (title)")
      .eq("reviewer_id", profile.id)
      .order("created_at", { ascending: false }),
    supabase.rpc("instructor_public_stats", { target: profile.id }),
    supabase
      .from("job_confirmations")
      .select("job_id, job:jobs!inner(id,title,starts_on,status)")
      .eq("instructor_id", profile.id)
      .eq("job.status", "completed"),
    supabase
      .from("job_segment_confirmations")
      .select("job_id, job:jobs!inner(id,title,starts_on,status)")
      .eq("instructor_id", profile.id)
      .eq("job.status", "completed")
      .not("confirmed_at", "is", null)
      .is("cancelled_at", null),
  ]);

  const received =
    (receivedResult.data as unknown as (Review & { job: { title: string } | null })[]) ??
    [];
  const given =
    (givenResult.data as unknown as (Review & { job: { title: string } | null })[]) ??
    [];
  const stats =
    ((statsResult.data as InstructorPublicStats[] | null) ?? [])[0] ?? null;
  const givenJobIds = new Set(given.map((review) => review.job_id));
  const completedAssignments = [
    ...((completedResult.data as unknown as {
      job_id: string;
      job: { id: string; title: string; starts_on: string } | null;
    }[] | null) ?? []),
    ...((completedSegmentsResult.data as unknown as {
      job_id: string;
      job: { id: string; title: string; starts_on: string } | null;
    }[] | null) ?? []),
  ];
  const uniqueCompletedAssignments = Array.from(
    new Map(completedAssignments.map((item) => [item.job_id, item])).values(),
  );
  const pendingReviews = uniqueCompletedAssignments.filter(
    (item) => !givenJobIds.has(item.job_id),
  ) as {
    job_id: string;
    job: { id: string; title: string; starts_on: string } | null;
  }[];

  const visibleReviews = activeView === "received" ? received : given;

  return (
    <Page width="narrow">
      <PageHeader title="Reviews" />

      {pendingReviews.length > 0 ? (
        <PendingReviews
          description="Rond deze beoordeling af om weer op nieuwe opdrachten te reageren."
          items={pendingReviews.map((item) => ({
            id: item.job_id,
            title: item.job?.title ?? "Opdracht",
            href: `/opdrachten/${item.job_id}`,
          }))}
        />
      ) : null}

      {stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            icon={Star}
            label="Gemiddelde score"
            tone="warning"
            value={stats.avg_rating ?? "—"}
          />
          <StatTile label="Beoordelingen" value={stats.review_count} />
          <StatTile label="Afgeronde opdrachten" value={stats.completed_count} />
          <StatTile
            label="Betrouwbaarheid"
            value={
              stats.reliability_score != null
                ? `${stats.reliability_score}%`
                : "Nieuw"
            }
          />
        </div>
      ) : null}

      <TabLinks
        fullWidth
        items={[
          {
            href: "/reviews?view=received",
            label: "Ontvangen",
            count: received.length,
            active: activeView === "received",
          },
          {
            href: "/reviews?view=given",
            label: "Gegeven",
            count: given.length,
            active: activeView === "given",
          },
        ]}
        label="Reviewweergave"
      />

      <Panel>
        <PanelHeader
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
