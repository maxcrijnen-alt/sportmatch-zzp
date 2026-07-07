"use client";

import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { submitReviewAction, type JobActionState } from "@/lib/jobs/actions";
import { cn } from "@/lib/utils";

const initialState: JobActionState = { error: null, success: null };

export function ReviewForm({ jobId }: { jobId: string }) {
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

      <Button disabled={isPending || rating === 0} type="submit">
        {isPending ? "Versturen…" : "Beoordeling versturen"}
      </Button>
    </form>
  );
}
