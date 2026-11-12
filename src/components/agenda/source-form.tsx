"use client";
import { useActionState } from "react";
import {
  syncExampleAction,
  type AgendaActionState,
} from "@/lib/agenda/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function SourceForm({
  locationId,
  version,
  enabled,
}: {
  locationId: string;
  version: number;
  enabled: boolean;
}) {
  const [state, action, pending] = useActionState<AgendaActionState, FormData>(
    syncExampleAction,
    { error: null },
  );
  return (
    <form action={action} className="space-y-3">
      <input name="locationId" type="hidden" value={locationId} />
      <input name="version" type="hidden" value={version} />
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state.success ? (
        <p role="status" className="text-sm">
          {state.success}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button name="enabled" value="true" disabled={pending} type="submit">
          {pending
            ? "Synchroniseren…"
            : enabled
              ? "Opnieuw synchroniseren"
              : "Voorbeeldrooster tonen"}
        </Button>
        {enabled ? (
          <Button
            variant="outline"
            name="enabled"
            value="false"
            disabled={pending}
            type="submit"
          >
            Voorbeeldrooster verbergen
          </Button>
        ) : null}
      </div>
    </form>
  );
}
