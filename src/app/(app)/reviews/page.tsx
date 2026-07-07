import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Star } from "lucide-react";
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
import { createClient } from "@/lib/supabase/server";
import type { InstructorPublicStats, Review } from "@/types/database";

export const metadata: Metadata = {
  title: "Reviews",
};

export default async function ReviewsPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile || !supabase) {
    redirect("/login");
  }

  const [receivedResult, givenResult, statsResult] = await Promise.all([
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
  ]);

  const received =
    (receivedResult.data as unknown as (Review & { job: { title: string } | null })[]) ??
    [];
  const given =
    (givenResult.data as unknown as (Review & { job: { title: string } | null })[]) ??
    [];
  const stats =
    ((statsResult.data as InstructorPublicStats[] | null) ?? [])[0] ?? null;

  const StarRow = ({ rating }: { rating: number }) => (
    <span className="text-warning">
      {"★".repeat(rating)}
      <span className="text-muted-foreground/40">{"★".repeat(5 - rating)}</span>
    </span>
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reviews</h1>
        <p className="text-sm text-muted-foreground">
          Jouw beoordelingen en betrouwbaarheidsscore.
        </p>
      </div>

      {stats ? (
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Gemiddelde score</CardDescription>
              <CardTitle className="flex items-center gap-1 text-2xl">
                <Star className="h-5 w-5 fill-warning text-warning" />
                {stats.avg_rating ?? "—"}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Beoordelingen</CardDescription>
              <CardTitle className="text-2xl">{stats.review_count}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Afgeronde opdrachten</CardDescription>
              <CardTitle className="text-2xl">{stats.completed_count}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Betrouwbaarheid</CardDescription>
              <CardTitle className="text-2xl">
                {stats.reliability_score != null
                  ? `${stats.reliability_score}%`
                  : "Nieuw"}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Ontvangen beoordelingen</CardTitle>
          <CardDescription>
            Beoordelingen worden zichtbaar nadat beide partijen hebben
            beoordeeld.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {received.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nog geen ontvangen beoordelingen.
            </p>
          ) : (
            received.map((review) => (
              <div
                className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
                key={review.id}
              >
                <div>
                  <StarRow rating={review.rating} />
                  <p className="text-xs text-muted-foreground">
                    {review.job?.title} · {formatDate(review.created_at)}
                  </p>
                </div>
                <Badge variant="muted">
                  {review.side === "instructor" ? "Instructeur" : "Organisatie"}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gegeven beoordelingen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {given.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nog geen beoordelingen gegeven.
            </p>
          ) : (
            given.map((review) => (
              <div
                className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
                key={review.id}
              >
                <div>
                  <StarRow rating={review.rating} />
                  <p className="text-xs text-muted-foreground">
                    {review.job?.title} · {formatDate(review.created_at)}
                  </p>
                </div>
                {!review.released_at ? (
                  <Badge variant="secondary">Wacht op tegenpartij</Badge>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
