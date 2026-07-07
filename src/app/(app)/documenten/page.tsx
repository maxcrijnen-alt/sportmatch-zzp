import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BadgeCheck, FileText } from "lucide-react";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionProfile } from "@/lib/auth/session";
import { documentTypeLabels, formatDate } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { DocumentUpload } from "@/types/database";

export const metadata: Metadata = {
  title: "Documenten",
};

const EXPIRY_WARNING_DAYS = 30;

export default async function DocumentenPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile || !supabase) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("document_uploads")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  const documents = (data as DocumentUpload[] | null) ?? [];

  const approvedTypes = new Set(
    documents
      .filter((document) => document.status === "approved")
      .map((document) => document.doc_type),
  );

  const expiringSoon = documents.filter((document) => {
    if (document.status !== "approved" || !document.expires_at) {
      return false;
    }
    const daysLeft =
      (new Date(document.expires_at).getTime() - Date.now()) /
      (1000 * 60 * 60 * 24);
    return daysLeft > 0 && daysLeft <= EXPIRY_WARNING_DAYS;
  });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documenten</h1>
        <p className="text-sm text-muted-foreground">
          Upload je diploma&apos;s en certificaten. Na handmatige controle krijg
          je badges die organisaties zien.
        </p>
      </div>

      {approvedTypes.size > 0 ? (
        <div className="flex flex-wrap gap-2">
          {Array.from(approvedTypes).map((docType) => (
            <Badge key={docType} variant="success">
              <BadgeCheck className="h-3 w-3" />
              {documentTypeLabels[docType]} gecontroleerd
            </Badge>
          ))}
        </div>
      ) : null}

      {expiringSoon.length > 0 ? (
        <Alert variant="warning">
          <AlertTitle>Certificaten verlopen binnenkort</AlertTitle>
          <AlertDescription>
            {expiringSoon
              .map(
                (document) =>
                  `${documentTypeLabels[document.doc_type]} (geldig tot ${formatDate(document.expires_at!)})`,
              )
              .join(", ")}
            . Upload tijdig een nieuwe versie.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Nieuw document uploaden</CardTitle>
          <CardDescription>
            Sportdiploma&apos;s, EHBO/BHV/AED, VOG en
            aansprakelijkheidsverzekering.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DocumentUploadForm userId={profile.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mijn documenten</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nog geen documenten geüpload.
            </p>
          ) : (
            documents.map((document) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                key={document.id}
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {documentTypeLabels[document.doc_type]}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {document.original_filename}
                      {document.expires_at
                        ? ` · geldig tot ${formatDate(document.expires_at)}`
                        : ""}
                    </p>
                    {document.review_note ? (
                      <p className="text-xs text-destructive">
                        {document.review_note}
                      </p>
                    ) : null}
                  </div>
                </div>
                <DocumentStatusBadge status={document.status} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
