"use client";

import { useActionState } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  inviteConnectedInstructorsAction,
  type JobActionState,
} from "@/lib/jobs/actions";

const initialState: JobActionState = { error: null, success: null };

export function PoolInviteForm({
  jobId,
  count,
}: {
  jobId: string;
  count: number;
}) {
  const [state, formAction, isPending] = useActionState(
    inviteConnectedInstructorsAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input name="jobId" type="hidden" value={jobId} />
      <Button disabled={isPending} size="sm" type="submit" variant="outline">
        <Users className="h-3.5 w-3.5" />
        {isPending ? "Uitnodigen…" : "Mijn poule uitnodigen"}
      </Button>
      <span className="text-xs text-muted-foreground">
        {count} instructeurs
      </span>
      {state.error ? (
        <span className="text-xs text-destructive" role="alert">{state.error}</span>
      ) : null}
      {state.success ? (
        <span className="text-xs text-primary" role="status">{state.success}</span>
      ) : null}
    </form>
  );
}
