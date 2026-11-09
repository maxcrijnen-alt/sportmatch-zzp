"use client";

import { useActionState } from "react";
import { BookmarkCheck, BookmarkPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  setInstructorConnectionAction,
  type ConnectionActionState,
} from "@/lib/org/connections";

export function ConnectionButton({
  instructorId,
  initialConnected,
  expanded = false,
}: {
  instructorId: string;
  initialConnected: boolean;
  expanded?: boolean;
}) {
  const initialState: ConnectionActionState = {
    connected: initialConnected,
    error: null,
  };
  const [state, formAction, isPending] = useActionState(
    setInstructorConnectionAction,
    initialState,
  );
  const connected = state.connected;

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input name="instructorId" type="hidden" value={instructorId} />
      <input
        name="connected"
        type="hidden"
        value={connected ? "false" : "true"}
      />
      {expanded && connected ? <Badge variant="default">In poule</Badge> : null}
      <Button
        aria-label={connected ? "Verwijderen uit poule" : "Toevoegen aan poule"}
        className={connected ? "border border-primary/20" : undefined}
        disabled={isPending}
        size="sm"
        title={connected ? "Verwijderen uit poule" : "Toevoegen aan poule"}
        type="submit"
        variant={connected ? "soft" : "outline"}
      >
        {connected ? (
          <BookmarkCheck className="h-3.5 w-3.5" />
        ) : (
          <BookmarkPlus className="h-3.5 w-3.5" />
        )}
        {isPending
          ? "Opslaan…"
          : expanded
            ? connected
              ? "Verwijderen"
              : "Toevoegen aan poule"
            : connected
              ? "In poule"
              : "Opslaan"}
      </Button>
      {state.error ? (
        <span className="text-xs text-destructive" role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
