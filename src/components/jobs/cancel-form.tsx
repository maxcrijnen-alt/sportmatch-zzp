"use client";

import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [forceMajeure, setForceMajeure] = useState(false);

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
        Bij een normale annulering wordt 150% van de totale afgesproken
        vergoeding geregistreerd. Er vindt nog geen automatische betaling
        plaats. Overweeg eerst een vervanger voor te stellen.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="cancel-reason">Reden</Label>
        <Textarea id="cancel-reason" name="reason" required rows={2} />
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          className="mt-1"
          name="forceMajeure"
          onChange={(event) => setForceMajeure(event.target.checked)}
          type="checkbox"
        />
        <span>
          Dit is aantoonbare overmacht of een noodsituatie. SportMatch beoordeelt
          de motivatie en het eventuele bewijs.
        </span>
      </label>

      {forceMajeure ? (
        <div className="space-y-1.5">
          <Label htmlFor={`cancel-evidence-${jobId}`}>Bewijs (optioneel, privé)</Label>
          <Input accept="image/*,application/pdf" id={`cancel-evidence-${jobId}`} name="evidence" type="file" />
        </div>
      ) : null}

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
