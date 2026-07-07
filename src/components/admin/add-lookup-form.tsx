"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addLookupAction, type AdminActionState } from "@/lib/admin/actions";

const initialState: AdminActionState = { error: null, success: null };

export function AddLookupForm({ kind }: { kind: "sport" | "qualification" }) {
  const boundAction = addLookupAction.bind(null, kind);
  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-2">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex gap-2">
        <Input
          name="name"
          placeholder={kind === "sport" ? "Nieuwe sport…" : "Nieuw diploma…"}
          required
        />
        <Button disabled={isPending} type="submit" variant="outline">
          {isPending ? "Toevoegen…" : "Toevoegen"}
        </Button>
      </div>
    </form>
  );
}
