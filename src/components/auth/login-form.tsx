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
    label: "Sportschool",
    description: "Eigenaar FitZone Utrecht",
    email: "sportschool@sportmatch.test",
  },
  {
    label: "Instructeur",
    description: "Profiel met historie en badges",
    email: "instructeur@sportmatch.test",
  },
  {
    label: "Planner",
    description: "Teamlid bij FitZone Utrecht",
    email: "planner@sportmatch.test",
  },
  {
    label: "Admin",
    description: "Beheeromgeving controleren",
    email: "admin@sportmatch.test",
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
              Kies een rol om direct met gevulde inloggegevens te testen.
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
          Alle demo-accounts gebruiken wachtwoord {demoPassword}.
        </p>
      </div>

      <Button className="w-full" disabled={isPending} type="submit">
        {isPending ? "Bezig met inloggen…" : "Inloggen"}
      </Button>
    </form>
  );
}
