"use client";

import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  stopJobSearchAction,
  type JobActionState,
} from "@/lib/jobs/actions";

const initialState: JobActionState = { error: null, success: null };

export function StopSearchForm({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    stopJobSearchAction,
    initialState,
  );

  if (!open && !state.success) {
    return (
      <Button onClick={() => setOpen(true)} size="sm" type="button" variant="outline">
        Stop met zoeken
      </Button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-border p-4">
      <input name="jobId" type="hidden" value={jobId} />
      <p className="text-sm font-medium">Stop met zoeken</p>
      <p className="text-xs text-muted-foreground">
        Nieuwe instructeurs kunnen hierna niet meer reageren. Een match via
        SportMatch rond je af via kandidaatselectie en bevestiging.
      </p>
      {state.error ? (
        <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>
      ) : null}
      {state.success ? (
        <Alert variant="info"><AlertDescription>{state.success}</AlertDescription></Alert>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor={`close-reason-${jobId}`}>Reden</Label>
            <Select defaultValue="" id={`close-reason-${jobId}`} name="reason" required>
              <option disabled value="">Kies een reden</option>
              <option value="internal_match">Intern iemand gevonden</option>
              <option value="lesson_cancelled">Les vervalt</option>
              <option value="no_longer_needed">Niet meer nodig</option>
              <option value="other">Anders</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`close-note-${jobId}`}>Toelichting (optioneel)</Label>
            <Textarea id={`close-note-${jobId}`} name="note" rows={2} />
          </div>
          <div className="flex gap-2">
            <Button disabled={isPending} size="sm" type="submit">
              {isPending ? "Opslaan…" : "Bevestig stop met zoeken"}
            </Button>
            <Button onClick={() => setOpen(false)} size="sm" type="button" variant="ghost">Terug</Button>
          </div>
        </>
      )}
    </form>
  );
}
