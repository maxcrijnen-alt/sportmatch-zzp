"use client";

import { useActionState } from "react";
import { saveLessonAction } from "@/lib/agenda/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { LessonInput } from "@/lib/agenda/lesson-contract";

export function LessonForm({
  locations,
  sports,
  initial,
}: {
  locations: { id: string; name: string }[];
  sports: { id: string; name: string }[];
  initial: Partial<LessonInput> & { externalId: string; locationId?: string };
}) {
  const [state, action, pending] = useActionState(saveLessonAction, {
    error: null,
  });
  const editing = (initial.revision ?? 0) > 0;
  return (
    <form action={action} className="space-y-4">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <input name="externalId" type="hidden" value={initial.externalId} />
      <input name="revision" type="hidden" value={initial.revision ?? 0} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="locationId">Vestiging</Label>
          <Select
            id="locationId"
            name="locationId"
            required
            defaultValue={initial.locationId ?? ""}
          >
            <option disabled value="">
              Kies een vestiging
            </option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sportId">Sport</Label>
          <Select
            id="sportId"
            name="sportId"
            required
            defaultValue={initial.sportId ?? ""}
          >
            <option disabled value="">
              Kies een sport
            </option>
            {sports.map((sport) => (
              <option key={sport.id} value={sport.id}>
                {sport.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="title">Naam van de les</Label>
          <Input
            id="title"
            name="title"
            required
            minLength={2}
            maxLength={120}
            defaultValue={initial.title}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lessonType">Soort les</Label>
          <Input
            id="lessonType"
            name="lessonType"
            required
            minLength={2}
            maxLength={100}
            defaultValue={initial.lessonType}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date">Datum</Label>
          <Input
            id="date"
            name="date"
            required
            type="date"
            defaultValue={initial.date}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="instructor">Instructeur (optioneel)</Label>
          <Input
            id="instructor"
            name="instructor"
            maxLength={80}
            defaultValue={initial.instructor}
          />
          <p className="text-xs text-muted-foreground">
            Gebruik een korte weergavenaam; geen contactgegevens.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="startTime">Begintijd</Label>
          <Input
            id="startTime"
            name="startTime"
            required
            type="time"
            defaultValue={initial.startTime}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endTime">Eindtijd</Label>
          <Input
            id="endTime"
            name="endTime"
            required
            type="time"
            defaultValue={initial.endTime}
          />
        </div>
        {!editing ? (
          <div className="space-y-1.5">
            <Label htmlFor="count">Aantal wekelijkse lessen</Label>
            <Input
              id="count"
              name="count"
              type="number"
              min={1}
              max={52}
              defaultValue={1}
            />
            <p className="text-xs text-muted-foreground">
              Elke datum krijgt een eigen les. Wijzigingen gelden daarna per
              les.
            </p>
          </div>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">
        Lestijden zijn Nederlandse tijd (Europe/Amsterdam). Lessen eindigen op
        dezelfde dag.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input
          name="needsSubstitute"
          type="checkbox"
          defaultChecked={initial.needsSubstitute}
        />
        Invalinstructeur nodig
      </label>
      {editing ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            name="cancelled"
            type="checkbox"
            defaultChecked={initial.cancelled}
          />
          Les geannuleerd
        </label>
      ) : null}
      <Button disabled={pending} type="submit">
        {pending ? "Opslaan…" : "Les opslaan"}
      </Button>
    </form>
  );
}
