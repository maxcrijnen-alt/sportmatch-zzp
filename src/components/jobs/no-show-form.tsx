"use client";

import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { recordNoShowAction, type JobActionState } from "@/lib/jobs/actions";

const initialState: JobActionState = { error: null, success: null };

export function NoShowForm({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    recordNoShowAction,
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
      <Button onClick={() => setOpen(true)} size="sm" type="button" variant="outline">
        No-show melden
      </Button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-border p-4">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <input name="jobId" type="hidden" value={jobId} />
      <div className="space-y-1.5">
        <Label htmlFor="no-show-note">Toelichting</Label>
        <Textarea id="no-show-note" name="note" rows={2} />
      </div>
      <div className="flex gap-2">
        <Button disabled={isPending} size="sm" type="submit" variant="destructive">
          {isPending ? "Melden…" : "No-show registreren"}
        </Button>
        <Button onClick={() => setOpen(false)} size="sm" type="button" variant="ghost">
          Terug
        </Button>
      </div>
    </form>
  );
}
