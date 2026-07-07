"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  addAvailabilityExceptionAction,
  addAvailabilityRuleAction,
  type AvailabilityActionState,
} from "@/lib/availability/actions";

const initialState: AvailabilityActionState = { error: null };

export const WEEKDAYS = [
  "Zondag",
  "Maandag",
  "Dinsdag",
  "Woensdag",
  "Donderdag",
  "Vrijdag",
  "Zaterdag",
];

export function AddRuleForm() {
  const [state, formAction, isPending] = useActionState(
    addAvailabilityRuleAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="weekday">Dag</Label>
          <Select defaultValue="1" id="weekday" name="weekday">
            {WEEKDAYS.map((day, index) => (
              <option key={day} value={index}>
                {day}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="startTime">Van</Label>
          <Input id="startTime" name="startTime" required type="time" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endTime">Tot</Label>
          <Input id="endTime" name="endTime" required type="time" />
        </div>
        <div className="flex items-end">
          <Button className="w-full" disabled={isPending} type="submit" variant="outline">
            {isPending ? "Toevoegen…" : "Toevoegen"}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function AddExceptionForm() {
  const [state, formAction, isPending] = useActionState(
    addAvailabilityExceptionAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="onDate">Datum niet beschikbaar</Label>
          <Input id="onDate" name="onDate" required type="date" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="note">Notitie (optioneel)</Label>
          <Input id="note" name="note" placeholder="Bijv. vakantie" />
        </div>
        <div className="flex items-end">
          <Button className="w-full" disabled={isPending} type="submit" variant="outline">
            {isPending ? "Toevoegen…" : "Blokkeren"}
          </Button>
        </div>
      </div>
    </form>
  );
}
