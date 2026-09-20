"use client";

import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { applyToJobAction, type JobActionState } from "@/lib/jobs/actions";

const initialState: JobActionState = { error: null, success: null };

interface ApplySegment {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
}

export function ApplyForm({
  jobId,
  segments = [],
  partialAllowed = false,
}: {
  jobId: string;
  segments?: ApplySegment[];
  partialAllowed?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    applyToJobAction,
    initialState,
  );
  const [selectedSegments, setSelectedSegments] = useState(
    segments.map((segment) => segment.id),
  );

  if (state.success) {
    return (
      <Alert variant="info">
        <AlertDescription>{state.success}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <input name="jobId" type="hidden" value={jobId} />

      {segments.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Welke lessen neem je over?</legend>
          <p className="text-xs text-muted-foreground">
            {partialAllowed
              ? "Je kunt één of meer direct aansluitende lessen kiezen."
              : "Dit blok moet volledig door één instructeur worden overgenomen."}
          </p>
          {segments.map((segment) => (
            <label className="flex items-center gap-3 rounded-md border border-border p-3 text-sm" key={segment.id}>
              <input
                checked={selectedSegments.includes(segment.id)}
                disabled={!partialAllowed}
                name="segmentIds"
                onChange={(event) =>
                  setSelectedSegments((current) =>
                    event.target.checked
                      ? [...current, segment.id]
                      : current.filter((id) => id !== segment.id),
                  )
                }
                type="checkbox"
                value={segment.id}
              />
              <span>
                <strong>{segment.startTime.slice(0, 5)}–{segment.endTime.slice(0, 5)}</strong>{" "}
                {segment.label}
              </span>
              {!partialAllowed ? (
                <input name="segmentIds" type="hidden" value={segment.id} />
              ) : null}
            </label>
          ))}
        </fieldset>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="message">Kort bericht (optioneel)</Label>
        <Textarea
          id="message"
          name="message"
          placeholder="Stel jezelf kort voor en vertel waarom je past bij deze opdracht…"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="availabilityNote">Beschikbaarheid (optioneel)</Label>
        <Textarea
          id="availabilityNote"
          name="availabilityNote"
          placeholder="Bijv. de hele avond beschikbaar, of alleen tot 21:00…"
          rows={2}
        />
      </div>

      <Button className="w-full sm:w-auto" disabled={isPending} type="submit">
        {isPending ? "Versturen…" : "Ik ben beschikbaar"}
      </Button>
    </form>
  );
}
