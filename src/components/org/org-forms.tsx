"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { orgMemberRoleLabels } from "@/lib/labels";
import {
  addLocationAction,
  inviteMemberAction,
  reportConversionFeeAction,
  updateOrganizationAction,
  type OrgActionState,
} from "@/lib/org/actions";
import type { City, Organization, OrgMemberRole } from "@/types/database";

const initialState: OrgActionState = { error: null, success: null };

function StateAlerts({ state }: { state: OrgActionState }) {
  return (
    <>
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
    </>
  );
}

export function OrganizationForm({
  organization,
}: {
  organization: Organization;
}) {
  const [state, formAction, isPending] = useActionState(
    updateOrganizationAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <StateAlerts state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Bedrijfsnaam</Label>
          <Input defaultValue={organization.name} id="name" name="name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="kvkNumber">KvK-nummer</Label>
          <Input
            defaultValue={organization.kvk_number}
            id="kvkNumber"
            name="kvkNumber"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactName">Contactpersoon</Label>
          <Input
            defaultValue={organization.contact_name}
            id="contactName"
            name="contactName"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactEmail">Contact e-mailadres</Label>
          <Input
            defaultValue={organization.contact_email}
            id="contactEmail"
            name="contactEmail"
            required
            type="email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactPhone">Telefoonnummer</Label>
          <Input
            defaultValue={organization.contact_phone}
            id="contactPhone"
            name="contactPhone"
            required
            type="tel"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="billingEmail">Factuur e-mailadres (optioneel)</Label>
          <Input
            defaultValue={organization.billing_email}
            id="billingEmail"
            name="billingEmail"
            type="email"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="billingReference">Factuurreferentie (optioneel)</Label>
          <Input
            defaultValue={organization.billing_reference}
            id="billingReference"
            name="billingReference"
          />
        </div>
      </div>
      <Button disabled={isPending} type="submit">
        {isPending ? "Opslaan…" : "Opslaan"}
      </Button>
    </form>
  );
}

export function AddLocationForm({ cities }: { cities: City[] }) {
  const [state, formAction, isPending] = useActionState(
    addLocationAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <StateAlerts state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="location-name">Naam vestiging</Label>
          <Input id="location-name" name="name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location-city">Plaats</Label>
          <Select defaultValue="" id="location-city" name="cityId" required>
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
          <Label htmlFor="location-street">Straat</Label>
          <Input id="location-street" name="street" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="location-number">Nr.</Label>
            <Input id="location-number" name="houseNumber" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location-postal">Postcode</Label>
            <Input id="location-postal" name="postalCode" required />
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Elke vestiging krijgt automatisch 30 dagen gratis proefperiode; daarna
        € 5 per maand (excl. btw).
      </p>
      <Button disabled={isPending} type="submit">
        {isPending ? "Toevoegen…" : "Vestiging toevoegen"}
      </Button>
    </form>
  );
}

export function InviteMemberForm() {
  const [state, formAction, isPending] = useActionState(
    inviteMemberAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <StateAlerts state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="invite-email">E-mailadres medewerker</Label>
          <Input
            id="invite-email"
            name="email"
            placeholder="collega@sportschool.nl"
            required
            type="email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-role">Rol</Label>
          <Select defaultValue="planner" id="invite-role" name="memberRole">
            {(
              Object.entries(orgMemberRoleLabels) as [OrgMemberRole, string][]
            ).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <Button disabled={isPending} type="submit">
        {isPending ? "Uitnodigen…" : "Medewerker uitnodigen"}
      </Button>
    </form>
  );
}

export function ConversionFeeForm({
  instructors,
}: {
  instructors: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(
    reportConversionFeeAction,
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
    <form action={formAction} className="space-y-4">
      <StateAlerts state={state} />
      <div className="space-y-2">
        <Label htmlFor="fee-instructor">Instructeur</Label>
        <Select defaultValue="" id="fee-instructor" name="instructorId" required>
          <option disabled value="">
            Kies de aangenomen instructeur
          </option>
          {instructors.map((instructor) => (
            <option key={instructor.id} value={instructor.id}>
              {instructor.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="fee-note">Toelichting (optioneel)</Label>
        <Textarea
          id="fee-note"
          name="note"
          placeholder="Bijv. per 1 maart in dienst als instructeur groepslessen…"
          rows={2}
        />
      </div>
      <Button disabled={isPending} type="submit" variant="outline">
        {isPending ? "Melden…" : "Vaste aanname melden"}
      </Button>
    </form>
  );
}
