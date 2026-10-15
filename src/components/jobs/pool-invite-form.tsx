"use client";

import { useActionState, useState } from "react";
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
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, isPending] = useActionState(
    inviteConnectedInstructorsAction,
    initialState,
  );
  const poolLabel = count === 1 ? "1 instructeur" : `${count} instructeurs`;

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-center gap-2"
      onSubmit={() => setConfirming(false)}
    >
      <input name="jobId" type="hidden" value={jobId} />
      {confirming ? (
        <>
          <span className="max-w-sm text-xs text-muted-foreground" role="note">
            Je staat op het punt {poolLabel} uit te nodigen. Alleen instructeurs
            die nog niet betrokken zijn en aan de voorwaarden voldoen krijgen
            een uitnodiging.
          </span>
          <Button
            disabled={isPending}
            onClick={() => setConfirming(false)}
            size="sm"
            type="button"
            variant="ghost"
          >
            Annuleren
          </Button>
          <Button disabled={isPending} size="sm" type="submit">
            <Users className="h-3.5 w-3.5" />
            Ja, uitnodigen
          </Button>
        </>
      ) : (
        <>
          <Button
            disabled={isPending}
            onClick={() => setConfirming(true)}
            size="sm"
            type="button"
            variant="outline"
          >
            <Users className="h-3.5 w-3.5" />
            {isPending ? "Uitnodigen…" : "Mijn poule uitnodigen"}
          </Button>
          <span className="text-xs text-muted-foreground">{poolLabel}</span>
        </>
      )}
      {state.error ? (
        <span className="text-xs text-destructive" role="alert">
          {state.error}
        </span>
      ) : null}
      {state.success ? (
        <span className="text-xs text-primary" role="status">
          {state.success}
        </span>
      ) : null}
    </form>
  );
}
