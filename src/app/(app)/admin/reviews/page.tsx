import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { Review } from "@/types/database";

export const metadata: Metadata = {
  title: "Reviews",
};

interface ReviewRow extends Review {
  job: { title: string } | null;
}

export default async function AdminReviewsPage() {
  const supabase = await createClient();

  if (!supabase) {
    return null;
  }

  const { data } = await supabase
    .from("reviews")
    .select("*, job:jobs (title)")
    .order("created_at", { ascending: false })
    .limit(200);

  const reviews = (data as unknown as ReviewRow[] | null) ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Reviews</h1>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Opdracht</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Van</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Datum</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reviews.map((review) => (
              <TableRow key={review.id}>
                <TableCell className="font-medium">{review.job?.title}</TableCell>
                <TableCell className="text-warning">
                  {"★".repeat(review.rating)}
                </TableCell>
                <TableCell className="text-sm">
                  {review.side === "instructor" ? "Instructeur" : "Organisatie"}
                </TableCell>
                <TableCell>
                  <Badge variant={review.released_at ? "success" : "secondary"}>
                    {review.released_at ? "Vrijgegeven" : "Wacht op tegenpartij"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(review.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
