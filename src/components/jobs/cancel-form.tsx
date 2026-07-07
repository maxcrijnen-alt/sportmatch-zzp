"use client";

import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cancelJobAction, type JobActionState } from "@/lib/jobs/actions";

const initialState: JobActionState = { error: null, success: null };

export function CancelForm({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    cancelJobAction,
    initialState,
  );

  if (state.success) {
    return (
      <Alert variant="info">
        <AlertDescription>{state.success}</AlertDescription>
      </Alert>
    );
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} type="button" variant="destructive">
        Opdracht annuleren
      </Button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <input name="jobId" type="hidden" value={jobId} />

      <p className="text-sm">
        Let op: bij annulering korter dan 12 uur voor aanvang geldt de
        annuleringsregeling (25% – 100% van de afgesproken vergoeding,
        afhankelijk van het moment). Overweeg eerst een vervanger voor te
        stellen.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="cancel-reason">Reden</Label>
        <Textarea id="cancel-reason" name="reason" required rows={2} />
      </div>

      <div className="flex gap-2">
        <Button disabled={isPending} type="submit" variant="destructive">
          {isPending ? "Annuleren…" : "Definitief annuleren"}
        </Button>
        <Button onClick={() => setOpen(false)} type="button" variant="ghost">
          Terug
        </Button>
      </div>
    </form>
  );
}
