"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAction, type AuthActionState } from "@/lib/auth/actions";

const initialState: AuthActionState = { error: null };

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    signInAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

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
          autoComplete="current-password"
          id="password"
          name="password"
          required
          type="password"
        />
      </div>

      <Button className="w-full" disabled={isPending} type="submit">
        {isPending ? "Bezig met inloggen…" : "Inloggen"}
      </Button>
    </form>
  );
}
