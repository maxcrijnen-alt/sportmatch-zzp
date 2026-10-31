"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { acceptOrgInviteAction, type OrgActionState } from "@/lib/org/actions";

const initialState: OrgActionState = { error: null, success: null };

export function AcceptInviteForm({ memberId, organizationName }: { memberId: string; organizationName: string }) {
  const [state, action, pending] = useActionState(acceptOrgInviteAction.bind(null, memberId), initialState);
  return (
    <form action={action} className="space-y-2 border-t border-border py-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium">{organizationName}</p>
        <Button disabled={pending} size="sm" type="submit">
          {pending ? "Accepteren…" : "Uitnodiging accepteren"}
        </Button>
      </div>
      {state.error ? <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert> : null}
    </form>
  );
}
