"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { confirmJobAction, type JobActionState } from "@/lib/jobs/actions";

const initialState: JobActionState = { error: null, success: null };

export function ConfirmJobForm({ jobId }: { jobId: string }) {
  const [state, formAction, isPending] = useActionState(
    confirmJobAction,
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
      <Button disabled={isPending} size="lg" type="submit">
        {isPending ? "Bevestigen…" : "Ik ga akkoord — opdracht bevestigen"}
      </Button>
    </form>
  );
}
