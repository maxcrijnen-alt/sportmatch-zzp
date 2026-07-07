import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  refreshDocumentStatusesAction,
  reviewDocumentAction,
} from "@/lib/admin/actions";
import { documentTypeLabels, formatDate } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { DocumentUpload } from "@/types/database";

export const metadata: Metadata = {
  title: "Documentcontrole",
};

interface DocumentRow extends DocumentUpload {
  owner: { full_name: string; email: string } | null;
}

const SIGNED_URL_SECONDS = 60 * 10;

export default async function AdminDocumentenPage() {
  const supabase = await createClient();

  if (!supabase) {
    return null;
  }

  const { data } = await supabase
    .from("document_uploads")
    .select("*, owner:profiles!document_uploads_user_id_fkey (full_name, email)")
    .order("created_at", { ascending: false })
    .limit(100);

  const documents = (data as unknown as DocumentRow[] | null) ?? [];
  const pending = documents.filter((document) => document.status === "pending");
  const reviewed = documents.filter((document) => document.status !== "pending");

  // Tijdelijke inzage-URL's voor de beoordeling
  const signedUrls = new Map<string, string>();
  await Promise.all(
    pending.map(async (document) => {
      const { data: signed } = await supabase.storage
        .from("documents")
        .createSignedUrl(document.storage_path, SIGNED_URL_SECONDS);
      if (signed?.signedUrl) {
        signedUrls.set(document.id, signed.signedUrl);
      }
    }),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Documentcontrole</h1>
        <form action={refreshDocumentStatusesAction}>
          <Button size="sm" type="submit" variant="outline">
            Verlopen documenten markeren
          </Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Te beoordelen ({pending.length})</CardTitle>
          <CardDescription>
            Controleer het document en keur het goed of af. Vul bij certificaten
            de vervaldatum in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Geen documenten in de wachtrij.
            </p>
          ) : (
            pending.map((document) => (
              <form
                className="space-y-3 rounded-lg border border-border p-4"
                key={document.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {documentTypeLabels[document.doc_type]} —{" "}
                      {document.owner?.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {document.original_filename} · geüpload{" "}
                      {formatDate(document.created_at)}
                    </p>
                  </div>
                  {signedUrls.has(document.id) ? (
                    <a
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                      href={signedUrls.get(document.id)}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Bekijken <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    defaultValue={document.expires_at ?? ""}
                    name="expiresAt"
                    type="date"
                  />
                  <Input name="note" placeholder="Notitie (optioneel)" />
                </div>

                <div className="flex gap-2">
                  <Button
                    formAction={reviewDocumentAction.bind(null, document.id, true)}
                    size="sm"
                    type="submit"
                  >
                    Goedkeuren
                  </Button>
                  <Button
                    formAction={reviewDocumentAction.bind(null, document.id, false)}
                    size="sm"
                    type="submit"
                    variant="destructive"
                  >
                    Afkeuren
                  </Button>
                </div>
              </form>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Eerder beoordeeld</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {reviewed.map((document) => (
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm"
              key={document.id}
            >
              <div>
                <p className="font-medium">
                  {documentTypeLabels[document.doc_type]} —{" "}
                  {document.owner?.full_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {document.expires_at
                    ? `Geldig tot ${formatDate(document.expires_at)}`
                    : "Geen vervaldatum"}
                  {document.review_note ? ` · ${document.review_note}` : ""}
                </p>
              </div>
              <DocumentStatusBadge status={document.status} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
