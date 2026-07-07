"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { applyToJobAction, type JobActionState } from "@/lib/jobs/actions";

const initialState: JobActionState = { error: null, success: null };

export function ApplyForm({ jobId }: { jobId: string }) {
  const [state, formAction, isPending] = useActionState(
    applyToJobAction,
    initialState,
  );

  if (state.success) {
    return (
      <Alert variant="info">
        <AlertDescription>{state.success}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <input name="jobId" type="hidden" value={jobId} />

      <div className="space-y-2">
        <Label htmlFor="message">Kort bericht (optioneel)</Label>
        <Textarea
          id="message"
          name="message"
          placeholder="Stel jezelf kort voor en vertel waarom je past bij deze opdracht…"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="availabilityNote">Beschikbaarheid (optioneel)</Label>
        <Textarea
          id="availabilityNote"
          name="availabilityNote"
          placeholder="Bijv. de hele avond beschikbaar, of alleen tot 21:00…"
          rows={2}
        />
      </div>

      <Button className="w-full sm:w-auto" disabled={isPending} type="submit">
        {isPending ? "Versturen…" : "Ik ben beschikbaar"}
      </Button>
    </form>
  );
}
