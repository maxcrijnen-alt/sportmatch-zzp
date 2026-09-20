"use client";

import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitReviewAction, type JobActionState } from "@/lib/jobs/actions";
import { cn } from "@/lib/utils";

const initialState: JobActionState = { error: null, success: null };

export function ReviewForm({
  jobId,
  revieweeId,
}: {
  jobId: string;
  revieweeId?: string;
}) {
  const [state, formAction, isPending] = useActionState(
    submitReviewAction,
    initialState,
  );
  const [rating, setRating] = useState(0);

  if (state.success) {
    return (
      <Alert variant="info">
        <AlertDescription>{state.success}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <input name="jobId" type="hidden" value={jobId} />
      {revieweeId ? (
        <input name="revieweeId" type="hidden" value={revieweeId} />
      ) : null}
      <input name="rating" type="hidden" value={rating} />

      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            aria-label={`${value} sterren`}
            key={value}
            onClick={() => setRating(value)}
            type="button"
          >
            <Star
              className={cn(
                "h-8 w-8 transition-colors",
                value <= rating
                  ? "fill-warning text-warning"
                  : "text-muted-foreground/40 hover:text-warning",
              )}
            />
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Je beoordeling wordt pas zichtbaar nadat beide partijen hebben
        beoordeeld.
      </p>

      <div className="space-y-2">
        <Label htmlFor={`review-comment-${jobId}-${revieweeId ?? "party"}`}>
          Toelichting (optioneel)
        </Label>
        <Textarea
          id={`review-comment-${jobId}-${revieweeId ?? "party"}`}
          maxLength={2000}
          name="comment"
          rows={3}
        />
      </div>

      {rating > 0 && rating <= 2 ? (
        <div className="space-y-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input name="alsoReport" type="checkbox" />
            Ik wil dit ook melden bij SportMatch
          </label>
          <div className="space-y-2">
            <Label htmlFor={`report-details-${jobId}-${revieweeId ?? "party"}`}>
              Toelichting voor SportMatch
            </Label>
            <Textarea id={`report-details-${jobId}-${revieweeId ?? "party"}`} name="reportDetails" placeholder="Beschrijf wat er is gebeurd. De melding blijft los van je review." rows={3} />
          </div>
        </div>
      ) : null}

      <Button disabled={isPending || rating === 0} type="submit">
        {isPending ? "Versturen…" : "Beoordeling versturen"}
      </Button>
    </form>
  );
}
