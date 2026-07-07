"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  requestPasswordResetAction,
  updatePasswordAction,
  type PasswordActionState,
} from "@/lib/auth/password-actions";

const initialState: PasswordActionState = { error: null, success: null };

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    requestPasswordResetAction,
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
      <Button className="w-full" disabled={isPending} type="submit">
        {isPending ? "Versturen…" : "Stuur herstellink"}
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    updatePasswordAction,
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
        <Label htmlFor="password">Nieuw wachtwoord</Label>
        <Input
          autoComplete="new-password"
          id="password"
          minLength={8}
          name="password"
          required
          type="password"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Herhaal nieuw wachtwoord</Label>
        <Input
          autoComplete="new-password"
          id="confirm"
          minLength={8}
          name="confirm"
          required
          type="password"
        />
      </div>
      <Button className="w-full" disabled={isPending} type="submit">
        {isPending ? "Opslaan…" : "Wachtwoord wijzigen"}
      </Button>
    </form>
  );
}
