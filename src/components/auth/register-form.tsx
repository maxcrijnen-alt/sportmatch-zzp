"use client";

import { useActionState, useState } from "react";
import { Building2, Dumbbell } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { registerAction, type AuthActionState } from "@/lib/auth/actions";

const initialState: AuthActionState = { error: null };

export function RegisterForm({
  defaultRole,
}: {
  defaultRole: "instructor" | "organization";
}) {
  const [role, setRole] = useState<"instructor" | "organization">(defaultRole);
  const [state, formAction, isPending] = useActionState(
    registerAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <input name="role" type="hidden" value={role} />

      <div className="grid grid-cols-2 gap-3">
        <button
          className={cn(
            "flex flex-col items-center gap-2 rounded-lg border p-4 text-sm font-medium transition-colors",
            role === "instructor"
              ? "border-primary bg-primary/5 text-foreground"
              : "border-border text-muted-foreground hover:bg-muted",
          )}
          onClick={() => setRole("instructor")}
          type="button"
        >
          <Dumbbell className="h-6 w-6" />
          Ik ben instructeur
        </button>
        <button
          className={cn(
            "flex flex-col items-center gap-2 rounded-lg border p-4 text-sm font-medium transition-colors",
            role === "organization"
              ? "border-primary bg-primary/5 text-foreground"
              : "border-border text-muted-foreground hover:bg-muted",
          )}
          onClick={() => setRole("organization")}
          type="button"
        >
          <Building2 className="h-6 w-6" />
          Ik zoek instructeurs
        </button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fullName">
          {role === "organization" ? "Naam contactpersoon" : "Volledige naam"}
        </Label>
        <Input
          autoComplete="name"
          id="fullName"
          name="fullName"
          placeholder="Voor- en achternaam"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">E-mailadres</Label>
        <Input
          autoComplete="email"
          id="email"
          name="email"
          placeholder="naam@voorbeeld.nl"
          required
          type="email"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Wachtwoord</Label>
        <Input
          autoComplete="new-password"
          id="password"
          minLength={8}
          name="password"
          required
          type="password"
        />
        <p className="text-xs text-muted-foreground">Minimaal 8 tekens.</p>
      </div>

      <Button className="w-full" disabled={isPending} type="submit">
        {isPending ? "Account aanmaken…" : "Gratis account aanmaken"}
      </Button>

      <p className="text-xs text-muted-foreground">
        Door te registreren ga je akkoord met de algemene voorwaarden en het
        privacybeleid. Je proefperiode van 30 dagen start direct; er zijn geen
        betaalgegevens nodig.
      </p>
    </form>
  );
}
