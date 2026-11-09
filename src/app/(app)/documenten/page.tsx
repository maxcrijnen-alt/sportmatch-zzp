import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BadgeCheck, FileText } from "lucide-react";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { Page, PageHeader, Panel, PanelEmpty, PanelHeader } from "@/components/ui/page";
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
import { documentTypeLabels, expiresWithinDays, formatDate } from "@/lib/labels";
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

  const expiringSoon = documents.filter(
    (document) =>
      document.status === "approved" &&
      expiresWithinDays(document.expires_at, EXPIRY_WARNING_DAYS),
  );

  return (
    <Page width="narrow">
      <PageHeader title="Documenten" />

      {approvedTypes.size > 0 ? (
        <div className="flex flex-wrap gap-1.5">
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
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Nieuw document uploaden</CardTitle>
          <CardDescription>
            Sportdiploma&apos;s, EHBO/BHV/AED, VOG en aansprakelijkheidsverzekering.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <DocumentUploadForm userId={profile.id} />
        </CardContent>
      </Card>

      <Panel>
        <PanelHeader count={documents.length} icon={FileText} title="Mijn documenten" />
        <div>
          {documents.length === 0 ? (
            <PanelEmpty>Nog geen documenten geüpload.</PanelEmpty>
          ) : (
            documents.map((document) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 first:border-t-0 sm:px-5"
                key={document.id}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
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
        </div>
      </Panel>
    </Page>
  );
}
