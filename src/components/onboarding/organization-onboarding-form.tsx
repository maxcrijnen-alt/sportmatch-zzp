"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { organizationTypeLabels } from "@/lib/labels";
import {
  completeOrganizationOnboarding,
  type OnboardingActionState,
} from "@/lib/onboarding/actions";
import type { City, OrganizationType } from "@/types/database";

const initialState: OnboardingActionState = { error: null };

const orgTypeOptions = Object.entries(organizationTypeLabels) as [
  OrganizationType,
  string,
][];

export function OrganizationOnboardingForm({ cities }: { cities: City[] }) {
  const [state, formAction, isPending] = useActionState(
    completeOrganizationOnboarding,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-6">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold">Organisatie</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Bedrijfsnaam</Label>
            <Input id="name" name="name" placeholder="FitZone Utrecht" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="orgType">Type organisatie</Label>
            <Select defaultValue="" id="orgType" name="orgType" required>
              <option disabled value="">
                Kies een type
              </option>
              {orgTypeOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="kvkNumber">KvK-nummer (indien beschikbaar)</Label>
            <Input id="kvkNumber" name="kvkNumber" placeholder="12345678" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactPhone">Telefoonnummer</Label>
            <Input
              autoComplete="tel"
              id="contactPhone"
              name="contactPhone"
              placeholder="030 1234567"
              required
              type="tel"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold">Eerste vestiging</legend>
        <p className="text-xs text-muted-foreground">
          Elke vestiging heeft een eigen abonnement (€ 5 per maand na de gratis
          proefperiode). Meer vestigingen toevoegen kan later.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="locationName">Naam vestiging</Label>
            <Input
              id="locationName"
              name="locationName"
              placeholder="FitZone Centrum"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cityId">Plaats</Label>
            <Select defaultValue="" id="cityId" name="cityId" required>
              <option disabled value="">
                Kies een plaats
              </option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="street">Straat</Label>
            <Input id="street" name="street" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="houseNumber">Nr.</Label>
              <Input id="houseNumber" name="houseNumber" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">Postcode</Label>
              <Input id="postalCode" name="postalCode" placeholder="1234 AB" required />
            </div>
          </div>
        </div>
      </fieldset>

      <Button className="w-full sm:w-auto" disabled={isPending} size="lg" type="submit">
        {isPending ? "Opslaan…" : "Organisatie aanmaken"}
      </Button>
    </form>
  );
}
