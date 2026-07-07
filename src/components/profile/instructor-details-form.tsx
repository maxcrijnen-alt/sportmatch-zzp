"use client";

import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { instructorStatusLabels } from "@/lib/labels";
import {
  updateInstructorDetailsAction,
  type ProfileActionState,
} from "@/lib/profile/actions";
import { cn } from "@/lib/utils";
import type {
  InstructorProfile,
  InstructorStatus,
  Sport,
} from "@/types/database";

const initialState: ProfileActionState = { error: null, success: null };

const statusOptions = Object.entries(instructorStatusLabels) as [
  InstructorStatus,
  string,
][];

export function InstructorDetailsForm({
  details,
  sports,
  selectedStatuses,
  selectedSportIds,
}: {
  details: InstructorProfile;
  sports: Sport[];
  selectedStatuses: InstructorStatus[];
  selectedSportIds: string[];
}) {
  const [state, formAction, isPending] = useActionState(
    updateInstructorDetailsAction,
    initialState,
  );
  const [statuses, setStatuses] = useState<InstructorStatus[]>(selectedStatuses);
  const isZzp = statuses.includes("zzp");

  const toggleStatus = (status: InstructorStatus) => {
    setStatuses((current) =>
      current.includes(status)
        ? current.filter((item) => item !== status)
        : [...current, status],
    );
  };

  return (
    <form action={formAction} className="space-y-6">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state.success ? (
        <Alert variant="info">
          <AlertDescription>{state.success}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="hourlyRateEuro">Uurtarief (€)</Label>
          <Input
            defaultValue={
              details.hourly_rate_cents != null
                ? details.hourly_rate_cents / 100
                : undefined
            }
            id="hourlyRateEuro"
            min={1}
            name="hourlyRateEuro"
            required
            step="0.50"
            type="number"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="travelDistanceKm">Reisafstand (km)</Label>
          <Input
            defaultValue={details.travel_distance_km}
            id="travelDistanceKm"
            max={250}
            min={1}
            name="travelDistanceKm"
            required
            type="number"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="yearsExperience">Jaren ervaring</Label>
          <Input
            defaultValue={details.years_experience}
            id="yearsExperience"
            max={60}
            min={0}
            name="yearsExperience"
            required
            type="number"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Jouw situatie</Label>
        <div className="flex flex-wrap gap-2">
          {statusOptions.map(([status, label]) => (
            <label
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors",
                statuses.includes(status)
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
              key={status}
            >
              <input
                checked={statuses.includes(status)}
                className="sr-only"
                name="statuses"
                onChange={() => toggleStatus(status)}
                type="checkbox"
                value={status}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {isZzp ? (
        <div className="grid gap-4 rounded-lg border border-border bg-muted/40 p-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="kvkNumber">KvK-nummer</Label>
            <Input
              defaultValue={details.kvk_number}
              id="kvkNumber"
              name="kvkNumber"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="btwNumber">Btw-nummer (optioneel)</Label>
            <Input
              defaultValue={details.btw_number}
              id="btwNumber"
              name="btwNumber"
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label>Specialisaties</Label>
        <div className="flex flex-wrap gap-2">
          {sports.map((sport) => (
            <label
              className="cursor-pointer rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted has-checked:border-primary has-checked:bg-primary/10 has-checked:font-medium has-checked:text-primary"
              key={sport.id}
            >
              <input
                className="sr-only"
                defaultChecked={selectedSportIds.includes(sport.id)}
                name="sportIds"
                type="checkbox"
                value={sport.id}
              />
              {sport.name}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="workExperience">Werkervaring</Label>
        <Textarea
          defaultValue={details.work_experience}
          id="workExperience"
          name="workExperience"
          rows={4}
        />
      </div>

      <Button disabled={isPending} type="submit">
        {isPending ? "Opslaan…" : "Opslaan"}
      </Button>
    </form>
  );
}
