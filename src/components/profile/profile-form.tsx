"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  updateProfileAction,
  type ProfileActionState,
} from "@/lib/profile/actions";
import type { City, Profile } from "@/types/database";

const initialState: ProfileActionState = { error: null, success: null };

export function ProfileForm({
  profile,
  cities,
}: {
  profile: Profile;
  cities: City[];
}) {
  const [state, formAction, isPending] = useActionState(
    updateProfileAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fullName">Naam</Label>
          <Input
            defaultValue={profile.full_name}
            id="fullName"
            name="fullName"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefoonnummer</Label>
          <Input
            defaultValue={profile.phone}
            id="phone"
            name="phone"
            required
            type="tel"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cityId">Plaats</Label>
          <Select defaultValue={profile.city_id ?? ""} id="cityId" name="cityId">
            <option value="">Geen plaats gekozen</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mailadres</Label>
          <Input defaultValue={profile.email} disabled id="email" type="email" />
          <p className="text-xs text-muted-foreground">
            E-mailadres wijzigen kan in deze testversie nog niet.
          </p>
        </div>
      </div>

      <Button disabled={isPending} type="submit">
        {isPending ? "Opslaan…" : "Opslaan"}
      </Button>
    </form>
  );
}
