import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reviews</h1>
        <p className="text-sm text-muted-foreground">
          Beoordelingen rond jullie opdrachten (zichtbaar zodra beide partijen
          hebben beoordeeld).
        </p>
      </div>

      {pendingReviews.length > 0 ? (
        <Card className="border-warning/50 bg-warning/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Openstaande beoordeling</CardTitle>
            <CardDescription>
              Rond deze beoordeling af voordat je een nieuwe opdracht plaatst of kandidaat kiest.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {pendingReviews.map((job) => (
              <div className="flex items-center justify-between gap-3 rounded-md bg-background p-3" key={job.id as string}>
                <span className="text-sm font-medium">{job.title as string}</span>
                <Link href={`/organisatie/opdrachten/${job.id}`}><Button size="sm">Nu beoordelen</Button></Link>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Gemiddelde ontvangen score</CardDescription>
            <CardTitle className="flex items-center gap-1 text-2xl">
              <Star className="h-5 w-5 fill-warning text-warning" />
              {average ?? "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ontvangen beoordelingen</CardDescription>
            <CardTitle className="text-2xl">{receivedReviews.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="flex gap-1 rounded-md border border-border bg-muted/30 p-1">
        <Link
          className={
            activeView === "received"
              ? "flex-1 rounded px-3 py-1.5 text-center text-sm font-semibold bg-background shadow-sm"
              : "flex-1 rounded px-3 py-1.5 text-center text-sm font-medium text-muted-foreground hover:text-foreground"
          }
          href="/organisatie/reviews?view=received"
        >
          Ontvangen ({receivedReviews.length})
        </Link>
        <Link
          className={
            activeView === "given"
              ? "flex-1 rounded px-3 py-1.5 text-center text-sm font-semibold bg-background shadow-sm"
              : "flex-1 rounded px-3 py-1.5 text-center text-sm font-medium text-muted-foreground hover:text-foreground"
          }
          href="/organisatie/reviews?view=given"
        >
          Gegeven ({givenReviews.length})
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {activeView === "received"
              ? "Ontvangen beoordelingen"
              : "Gegeven beoordelingen"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {(activeView === "received" ? receivedReviews : givenReviews).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {activeView === "received"
                ? "Nog geen ontvangen beoordelingen."
                : "Nog geen beoordelingen gegeven."}
            </p>
          ) : (
            (activeView === "received" ? receivedReviews : givenReviews).map(
              (review) => (
                <div
                  className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 text-sm"
                  key={review.id}
                >
                  <div className="min-w-0">
                    <span className="text-warning">
                      {"★".repeat(review.rating)}
                      <span className="text-muted-foreground/40">
                        {"★".repeat(5 - review.rating)}
                      </span>
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {review.job?.title} · {formatDate(review.created_at)}
                    </p>
                    {review.comment ? (
                      <p className="mt-1 text-sm">“{review.comment}”</p>
                    ) : null}
                  </div>
                  {activeView === "given" && !review.released_at ? (
                    <Badge className="shrink-0" variant="secondary">
                      Wacht op tegenpartij
                    </Badge>
                  ) : null}
                </div>
              ),
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
