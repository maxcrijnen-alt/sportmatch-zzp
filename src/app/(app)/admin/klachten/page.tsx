import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  reviewForceMajeureAction,
  updateComplaintAction,
} from "@/lib/admin/actions";
import { formatDate } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { Cancellation, Complaint } from "@/types/database";

export const metadata: Metadata = { title: "Klachten" };

interface ComplaintRow extends Complaint {
  job: { id: string; title: string } | null;
  reporter: { full_name: string } | null;
}

interface CancellationRow extends Cancellation {
  job: { title: string } | null;
  canceller: { full_name: string } | null;
}

const statusLabels = {
  new: "Nieuw",
  in_progress: "In behandeling",
  resolved: "Opgelost",
  rejected: "Afgewezen",
};

export default async function AdminKlachtenPage() {
  const supabase = await createClient();
  if (!supabase) return null;

  const [{ data }, { data: cancellationData }] = await Promise.all([
    supabase
      .from("complaints")
      .select("*, job:jobs(id,title), reporter:profiles!complaints_reported_by_fkey(full_name)")
      .order("created_at", { ascending: false }),
    supabase
      .from("cancellations")
      .select("*, job:jobs(title), canceller:profiles!cancellations_cancelled_by_fkey(full_name)")
      .eq("force_majeure_status", "pending_review")
      .order("created_at"),
  ]);
  const complaints = (data as unknown as ComplaintRow[] | null) ?? [];
  const cancellations =
    (cancellationData as unknown as CancellationRow[] | null) ?? [];
  const signedUrls = new Map<string, string>();
  await Promise.all(
    [...complaints, ...cancellations]
      .filter((item) => item.evidence_path)
      .map(async (item) => {
        const { data: signed } = await supabase.storage
          .from("documents")
          .createSignedUrl(item.evidence_path!, 600);
        if (signed?.signedUrl) signedUrls.set(item.id, signed.signedUrl);
      }),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Klachten en meldingen</h1>
        <p className="text-sm text-muted-foreground">
          Privé gemelde problemen rond bevestigde en afgeronde opdrachten.
        </p>
      </div>
      <Card>
        <CardHeader><CardTitle>Overmacht te beoordelen ({cancellations.length})</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {cancellations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Geen openstaande verzoeken.</p>
          ) : cancellations.map((cancellation) => (
            <form className="space-y-3 rounded-lg border border-border p-4" key={cancellation.id}>
              <div>
                <p className="font-medium">{cancellation.job?.title}</p>
                <p className="text-xs text-muted-foreground">{cancellation.canceller?.full_name} · {formatDate(cancellation.created_at)}</p>
              </div>
              <p className="text-sm">{cancellation.reason}</p>
              <p className="text-sm font-medium">
                Normale registratie: € {((cancellation.compensation_amount_cents ?? 0) / 100).toFixed(2)} (150%)
              </p>
              {signedUrls.has(cancellation.id) ? (
                <a className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline" href={signedUrls.get(cancellation.id)} rel="noreferrer" target="_blank">Bewijs bekijken <ExternalLink className="h-3.5 w-3.5" /></a>
              ) : null}
              <Input name="note" placeholder="Motivering van de beoordeling" />
              <div className="flex gap-2">
                <Button formAction={reviewForceMajeureAction.bind(null, cancellation.id, true)} type="submit">Overmacht goedkeuren</Button>
                <Button formAction={reviewForceMajeureAction.bind(null, cancellation.id, false)} type="submit" variant="destructive">Afwijzen</Button>
              </div>
            </form>
          ))}
        </CardContent>
      </Card>
      <div className="space-y-4">
        {complaints.length === 0 ? (
          <Card><CardContent className="py-10 text-sm text-muted-foreground">Geen meldingen.</CardContent></Card>
        ) : complaints.map((complaint) => (
          <Card key={complaint.id}>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">{complaint.job?.title ?? "Opdracht"}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {complaint.reporter?.full_name} · {formatDate(complaint.created_at)} · {complaint.category}
                </p>
              </div>
              <Badge variant={complaint.status === "new" ? "warning" : complaint.status === "resolved" ? "success" : "muted"}>
                {statusLabels[complaint.status]}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="whitespace-pre-line text-sm">{complaint.details}</p>
              {signedUrls.has(complaint.id) ? (
                <a className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline" href={signedUrls.get(complaint.id)} rel="noreferrer" target="_blank">
                  Privébewijs bekijken <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
              <form action={updateComplaintAction.bind(null, complaint.id)} className="grid gap-3 sm:grid-cols-[12rem_1fr_auto]">
                <Select defaultValue={complaint.status} name="status">
                  <option value="new">Nieuw</option>
                  <option value="in_progress">In behandeling</option>
                  <option value="resolved">Opgelost</option>
                  <option value="rejected">Afgewezen</option>
                </Select>
                <Input defaultValue={complaint.resolution_note} name="resolutionNote" placeholder="Interne afhandeling/notitie" />
                <Button type="submit">Opslaan</Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
