"use client";

import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { instructorStatusLabels } from "@/lib/labels";
import {
  completeInstructorOnboarding,
  type OnboardingActionState,
} from "@/lib/onboarding/actions";
import { cn } from "@/lib/utils";
import type { City, InstructorStatus, Sport } from "@/types/database";

const initialState: OnboardingActionState = { error: null };

const statusOptions = Object.entries(instructorStatusLabels) as [
  InstructorStatus,
  string,
][];

export function InstructorOnboardingForm({
  cities,
  sports,
}: {
  cities: City[];
  sports: Sport[];
}) {
  const [state, formAction, isPending] = useActionState(
    completeInstructorOnboarding,
    initialState,
  );
  const [statuses, setStatuses] = useState<InstructorStatus[]>([]);
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Telefoonnummer</Label>
          <Input
            autoComplete="tel"
            id="phone"
            name="phone"
            placeholder="06 12345678"
            required
            type="tel"
          />
          <p className="text-xs text-muted-foreground">
            Alleen zichtbaar voor organisaties na een bevestigde opdracht.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="birthDate">Geboortedatum</Label>
          <Input id="birthDate" name="birthDate" required type="date" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cityId">Woonplaats</Label>
          <Select defaultValue="" id="cityId" name="cityId" required>
            <option disabled value="">
              Kies je woonplaats
            </option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">
            Andere gebruikers zien alleen je plaats, nooit je adres.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="travelDistanceKm">Maximale reisafstand (km)</Label>
          <Input
            defaultValue={25}
            id="travelDistanceKm"
            max={250}
            min={1}
            name="travelDistanceKm"
            required
            type="number"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hourlyRateEuro">Uurtarief (€, excl. btw)</Label>
          <Input
            id="hourlyRateEuro"
            min={1}
            name="hourlyRateEuro"
            placeholder="45"
            required
            step="0.50"
            type="number"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="yearsExperience">Jaren ervaring</Label>
          <Input
            defaultValue={0}
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
        <Label>Jouw situatie (meerdere mogelijk)</Label>
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
              id="kvkNumber"
              name="kvkNumber"
              placeholder="12345678"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="btwNumber">Btw-nummer (optioneel)</Label>
            <Input id="btwNumber" name="btwNumber" placeholder="NL123456789B01" />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Verplicht als je als zzp&apos;er op opdrachten wilt reageren. Je
            blijft zelf verantwoordelijk voor belastingen en verzekeringen.
          </p>
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
          id="workExperience"
          name="workExperience"
          placeholder="Vertel kort over je ervaring als instructeur…"
          rows={4}
        />
      </div>

      <Button className="w-full sm:w-auto" disabled={isPending} size="lg" type="submit">
        {isPending ? "Opslaan…" : "Profiel opslaan en starten"}
      </Button>
    </form>
  );
}
