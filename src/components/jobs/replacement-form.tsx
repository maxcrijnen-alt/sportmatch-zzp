"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  proposeReplacementAction,
  type JobActionState,
} from "@/lib/jobs/actions";

const initialState: JobActionState = { error: null, success: null };

export interface ReplacementCandidate {
  id: string;
  name: string;
}

export function ReplacementForm({
  jobId,
  candidates,
}: {
  jobId: string;
  candidates: ReplacementCandidate[];
}) {
  const [state, formAction, isPending] = useActionState(
    proposeReplacementAction,
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
    <form action={formAction} className="space-y-3">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <input name="jobId" type="hidden" value={jobId} />

      <div className="space-y-1.5">
        <Label htmlFor="replacementId">Vervanger</Label>
        <Select defaultValue="" id="replacementId" name="replacementId" required>
          <option disabled value="">
            Kies een instructeur
          </option>
          {candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
            </option>
          ))}
        </Select>
        <p className="text-xs text-muted-foreground">
          De organisatie moet de vervanger eerst goedkeuren.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="replacement-reason">Reden</Label>
        <Textarea id="replacement-reason" name="reason" required rows={2} />
      </div>

      <Button disabled={isPending} type="submit" variant="outline">
        {isPending ? "Versturen…" : "Vervanger voorstellen"}
      </Button>
    </form>
  );
}
