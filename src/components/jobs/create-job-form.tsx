"use client";

import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { jobTypeLabels } from "@/lib/labels";
import { createJobAction, type JobActionState } from "@/lib/jobs/actions";
import type {
  JobType,
  OrganizationLocation,
  PayType,
  Qualification,
  Sport,
} from "@/types/database";

const initialState: JobActionState = { error: null, success: null };

export function CreateJobForm({
  locations,
  sports,
  qualifications,
  defaultContactName,
}: {
  locations: OrganizationLocation[];
  sports: Sport[];
  qualifications: Qualification[];
  defaultContactName: string;
}) {
  const [state, formAction, isPending] = useActionState(
    createJobAction,
    initialState,
  );
  const [jobType, setJobType] = useState<JobType>("one_time");
  const [payType, setPayType] = useState<PayType>("hourly");

  return (
    <form action={formAction} className="space-y-6">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="jobType">Soort plaatsing</Label>
          <Select
            id="jobType"
            name="jobType"
            onChange={(event) => setJobType(event.target.value as JobType)}
            value={jobType}
          >
            {(Object.entries(jobTypeLabels) as [JobType, string][]).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ),
            )}
          </Select>
          {jobType === "urgent_substitute" ? (
            <p className="text-xs text-muted-foreground">
              Spoedopdrachten vallen extra op. Een hogere vergoeding vergroot de
              kans op snelle reacties.
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="sportId">Sport / soort les</Label>
          <Select defaultValue="" id="sportId" name="sportId" required>
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
        <div className="space-y-2">
          <Label htmlFor="locationId">Vestiging</Label>
          <Select defaultValue="" id="locationId" name="locationId" required>
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
        <div className="space-y-2">
          <Label htmlFor="contactName">Contactpersoon</Label>
          <Input
            defaultValue={defaultContactName}
            id="contactName"
            name="contactName"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Titel</Label>
        <Input
          id="title"
          name="title"
          placeholder="Bijv. Inval spinning dinsdagavond"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Beschrijving</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="Wat verwacht je van de instructeur? Denk aan lesinhoud, doelgroep en niveau…"
          required
          rows={4}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="startsOn">
            {jobType === "recurring" ? "Eerste datum" : "Datum"}
          </Label>
          <Input id="startsOn" name="startsOn" required type="date" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="startTime">Begintijd</Label>
          <Input id="startTime" name="startTime" required type="time" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endTime">Eindtijd</Label>
          <Input id="endTime" name="endTime" required type="time" />
        </div>
      </div>

      {jobType === "recurring" ? (
        <div className="space-y-2">
          <Label htmlFor="recurrenceNote">Terugkerend ritme</Label>
          <Input
            id="recurrenceNote"
            name="recurrenceNote"
            placeholder="Bijv. elke dinsdag 19:00–20:00, 12 weken"
            required
          />
        </div>
      ) : null}

      <div className="space-y-3 rounded-lg border border-border p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="payType">Vergoeding</Label>
            <Select
              id="payType"
              name="payType"
              onChange={(event) => setPayType(event.target.value as PayType)}
              value={payType}
            >
              <option value="hourly">Uurtarief</option>
              <option value="fixed">Vast bedrag</option>
              <option value="both">Beide mogelijk</option>
            </Select>
          </div>
          {payType === "fixed" || payType === "both" ? (
            <div className="space-y-2">
              <Label htmlFor="payAmountEuro">Vast bedrag (€)</Label>
              <Input
                id="payAmountEuro"
                min={0}
                name="payAmountEuro"
                step="0.50"
                type="number"
              />
            </div>
          ) : null}
          {payType === "hourly" || payType === "both" ? (
            <div className="space-y-2">
              <Label htmlFor="payHourlyRateEuro">Uurtarief (€)</Label>
              <Input
                id="payHourlyRateEuro"
                min={0}
                name="payHourlyRateEuro"
                step="0.50"
                type="number"
              />
            </div>
          ) : null}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            className="h-4 w-4 rounded border-border"
            name="payIsNegotiable"
            type="checkbox"
          />
          Vergoeding is onderhandelbaar (instructeurs kunnen altijd een
          tegenvoorstel doen)
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="requiredLevel">Gevraagd niveau (optioneel)</Label>
          <Input
            id="requiredLevel"
            name="requiredLevel"
            placeholder="Bijv. gevorderd, alle niveaus…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expectedParticipants">
            Verwacht aantal deelnemers (optioneel)
          </Label>
          <Input
            id="expectedParticipants"
            min={0}
            name="expectedParticipants"
            type="number"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Benodigde diploma&apos;s (optioneel)</Label>
        <div className="flex flex-wrap gap-2">
          {qualifications.map((qualification) => (
            <label
              className="cursor-pointer rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted has-checked:border-primary has-checked:bg-primary/10 has-checked:font-medium has-checked:text-primary"
              key={qualification.id}
            >
              <input
                className="sr-only"
                name="qualificationIds"
                type="checkbox"
                value={qualification.id}
              />
              {qualification.name}
            </label>
          ))}
        </div>
      </div>

      {jobType === "permanent" ? (
        <Alert>
          <AlertDescription>
            Voor vaste vacatures faciliteert het platform de sollicitatie en
            chat. De arbeidsovereenkomst sluit je zelf met de kandidaat. Bij
            aanname binnen 6 maanden geldt een eenmalige conversievergoeding van
            € 50 (excl. btw).
          </AlertDescription>
        </Alert>
      ) : null}

      <Button disabled={isPending} size="lg" type="submit">
        {isPending ? "Plaatsen…" : "Opdracht plaatsen"}
      </Button>
    </form>
  );
}
