"use client";

import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  selectCandidateAction,
  type JobActionState,
} from "@/lib/jobs/actions";

const initialState: JobActionState = { error: null, success: null };

export function SelectCandidateForm({
  applicationId,
  jobId,
  candidateName,
}: {
  applicationId: string;
  jobId: string;
  candidateName: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    selectCandidateAction,
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
      <Button onClick={() => setOpen(true)} size="sm" type="button">
        Deze kandidaat kiezen
      </Button>
    );
  }

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-4"
    >
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <input name="applicationId" type="hidden" value={applicationId} />
      <input name="jobId" type="hidden" value={jobId} />

      <p className="text-sm">
        Je kiest <strong>{candidateName}</strong>. Hiermee ga je als organisatie
        digitaal akkoord met de opdrachtvoorwaarden. De opdracht is definitief
        zodra de instructeur ook bevestigt.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor={`terms-${applicationId}`}>
          Aanvullende afspraken (optioneel)
        </Label>
        <Textarea
          id={`terms-${applicationId}`}
          name="termsNote"
          placeholder="Bijv. definitief tarief, aanwezig om 18:45, muziek zelf meenemen…"
          rows={2}
        />
      </div>

      <div className="flex gap-2">
        <Button disabled={isPending} size="sm" type="submit">
          {isPending ? "Bevestigen…" : "Akkoord en kandidaat kiezen"}
        </Button>
        <Button onClick={() => setOpen(false)} size="sm" type="button" variant="ghost">
          Terug
        </Button>
      </div>
    </form>
  );
}
