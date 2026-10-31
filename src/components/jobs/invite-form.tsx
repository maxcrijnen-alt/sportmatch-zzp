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
    return (
      <p className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary-soft px-3 text-[13px] font-medium text-primary-soft-foreground sm:h-8">
        Uitgenodigd ✓
      </p>
    );
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
      <Button disabled={isPending} size="sm" type="submit">
        {isPending ? "Uitnodigen…" : "Uitnodigen"}
      </Button>
    </form>
  );
}
