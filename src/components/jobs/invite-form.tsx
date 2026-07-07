"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  inviteInstructorAction,
  type JobActionState,
} from "@/lib/jobs/actions";

const initialState: JobActionState = { error: null, success: null };

export function InviteForm({
  jobId,
  instructorId,
}: {
  jobId: string;
  instructorId: string;
}) {
  const [state, formAction, isPending] = useActionState(
    inviteInstructorAction,
    initialState,
  );

  if (state.success) {
    return <p className="text-sm font-medium text-primary">Uitgenodigd ✓</p>;
  }

  return (
    <form action={formAction} className="space-y-2">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <input name="jobId" type="hidden" value={jobId} />
      <input name="instructorId" type="hidden" value={instructorId} />
      <Button disabled={isPending} size="sm" type="submit" variant="outline">
        {isPending ? "Uitnodigen…" : "Uitnodigen"}
      </Button>
    </form>
  );
}
