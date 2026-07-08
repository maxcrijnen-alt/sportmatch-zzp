"use client";

import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAction, type AuthActionState } from "@/lib/auth/actions";

const initialState: AuthActionState = { error: null };
const demoPassword = "SportMatch2026!";

const demoAccounts = [
  {
    label: "Demo als sportschool",
    description: "Opdrachten plaatsen en reacties beoordelen",
    email: "sportschool@sportmatch.test",
  },
  {
    label: "Demo als instructeur",
    description: "Opdrachten zoeken, reageren en opvolgen",
    email: "instructeur@sportmatch.test",
  },
];

export function LoginForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const [state, formAction, isPending] = useActionState(
    signInAction,
    initialState,
  );
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState(defaultEmail ? demoPassword : "");

  const useDemoAccount = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
  };

  const demoSelected =
    password === demoPassword &&
    demoAccounts.some((account) => account.email === email);

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
          onChange={(event) => setEmail(event.target.value)}
          placeholder="naam@voorbeeld.nl"
          required
          type="email"
          value={email}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Wachtwoord</Label>
        <Input
          autoComplete="current-password"
          id="password"
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </div>

      <div className="rounded-lg border border-border bg-muted/40 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Demo-accounts</p>
            <p className="text-xs text-muted-foreground">
              Kies sportschool of instructeur om direct met gevulde
              inloggegevens te testen.
            </p>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {demoAccounts.map((account) => (
            <button
              className="rounded-md border border-border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
              key={account.email}
              onClick={() => useDemoAccount(account.email)}
              type="button"
            >
              <span className="block font-medium text-foreground">
                {account.label}
              </span>
              <span className="block text-xs text-muted-foreground">
                {account.description}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Beide demo-accounts gebruiken wachtwoord {demoPassword}. Klik daarna
          op Log in met demo-account.
        </p>
      </div>

      <Button className="w-full" disabled={isPending} type="submit">
        {isPending
          ? "Bezig met inloggen…"
          : demoSelected
            ? "Log in met demo-account"
            : "Inloggen"}
      </Button>
    </form>
  );
}
