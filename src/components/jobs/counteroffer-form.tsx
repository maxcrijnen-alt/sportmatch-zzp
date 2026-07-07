"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createCounterofferAction,
  type JobActionState,
} from "@/lib/jobs/actions";

const initialState: JobActionState = { error: null, success: null };

export function CounterofferForm({ applicationId }: { applicationId: string }) {
  const [state, formAction, isPending] = useActionState(
    createCounterofferAction,
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

      <input name="applicationId" type="hidden" value={applicationId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="payType">Soort vergoeding</Label>
          <Select defaultValue="hourly" id="payType" name="payType">
            <option value="hourly">Per uur</option>
            <option value="fixed">Vast bedrag</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="amountEuro">Bedrag (€)</Label>
          <Input
            id="amountEuro"
            min={1}
            name="amountEuro"
            required
            step="0.50"
            type="number"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="counteroffer-message">Toelichting (optioneel)</Label>
        <Textarea
          id="counteroffer-message"
          name="message"
          placeholder="Bijv. spoedtarief of extra reiskosten…"
          rows={2}
        />
      </div>

      <Button disabled={isPending} type="submit" variant="outline">
        {isPending ? "Versturen…" : "Tegenvoorstel doen"}
      </Button>
    </form>
  );
}
