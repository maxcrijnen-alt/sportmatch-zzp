"use client";

import { useActionState, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { reportProblemAction, type JobActionState } from "@/lib/jobs/actions";

const initialState: JobActionState = { error: null, success: null };

export function ProblemReportForm({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(reportProblemAction, initialState);

  if (!open && !state.success) {
    return (
      <Button onClick={() => setOpen(true)} size="sm" type="button" variant="outline">
        <AlertTriangle className="h-4 w-4" /> Probleem melden
      </Button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-warning/40 p-4">
      <input name="jobId" type="hidden" value={jobId} />
      <p className="font-medium">Probleem melden bij SportMatch</p>
      <p className="text-xs text-muted-foreground">
        Alleen betrokken partijen en beheerders kunnen deze melding en het bewijs zien.
      </p>
      {state.error ? <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert> : null}
      {state.success ? <Alert variant="info"><AlertDescription>{state.success}</AlertDescription></Alert> : (
        <>
          <div className="space-y-2">
            <Label htmlFor={`complaint-category-${jobId}`}>Categorie</Label>
            <Select defaultValue="" id={`complaint-category-${jobId}`} name="category" required>
              <option disabled value="">Kies een categorie</option>
              <option value="safety">Veiligheid</option>
              <option value="conduct">Gedrag</option>
              <option value="agreement">Afspraken</option>
              <option value="no_show">No-show</option>
              <option value="payment">Vergoeding/betaling</option>
              <option value="other">Anders</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`complaint-details-${jobId}`}>Toelichting</Label>
            <Textarea id={`complaint-details-${jobId}`} maxLength={5000} minLength={10} name="details" required rows={4} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`complaint-evidence-${jobId}`}>Bewijs (optioneel, afbeelding of pdf)</Label>
            <Input accept="image/*,application/pdf" id={`complaint-evidence-${jobId}`} name="evidence" type="file" />
          </div>
          <div className="flex gap-2">
            <Button disabled={isPending} type="submit">{isPending ? "Versturen…" : "Melding versturen"}</Button>
            <Button onClick={() => setOpen(false)} type="button" variant="ghost">Terug</Button>
          </div>
        </>
      )}
    </form>
  );
}
