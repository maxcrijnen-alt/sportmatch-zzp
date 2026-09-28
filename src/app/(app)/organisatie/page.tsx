import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { ConversionFeeForm, OrganizationForm } from "@/components/org/org-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionProfile } from "@/lib/auth/session";
import { conversionFeeStatusLabels, organizationTypeLabels } from "@/lib/labels";
import { getOrgContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
import type { ConversionFee } from "@/types/database";

export const metadata: Metadata = {
  title: "Organisatie",
};

export default async function OrganisatiePage() {
  const profile = await getSessionProfile();
  const orgContext = await getOrgContext();
  const supabase = await createClient();

  if (!profile || !supabase) {
    redirect("/login");
  }

  if (!orgContext) {
    redirect("/dashboard");
  }

  // Instructeurs waarmee ooit een bevestigde opdracht was (voor conversiemelding)
  const { data: confirmedInstructors } = await supabase
    .from("job_confirmations")
    .select("instructor_id, job:jobs!inner(organization_id)")
    .eq("job.organization_id", orgContext.organization.id)
    .not("confirmed_at", "is", null);

  const instructorIds = Array.from(
    new Set(
      (confirmedInstructors ?? []).map((row) => row.instructor_id as string),
    ),
  );

  let knownInstructors: { id: string; name: string }[] = [];
  if (instructorIds.length > 0) {
    const { data: instructorProfiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", instructorIds);
    knownInstructors = (instructorProfiles ?? []).map((row) => ({
      id: row.id as string,
      name: row.full_name as string,
    }));
  }

  const { data: feesData } = await supabase
    .from("conversion_fees")
    .select("*")
    .eq("organization_id", orgContext.organization.id)
    .order("created_at", { ascending: false });

  const fees = (feesData as ConversionFee[] | null) ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {orgContext.organization.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {organizationTypeLabels[orgContext.organization.org_type]} · Jouw rol:{" "}
          {orgContext.memberRole === "owner"
            ? "eigenaar"
            : orgContext.memberRole === "planner"
              ? "planner"
              : "vestigingsmanager"}
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-md bg-primary/10 p-2 text-primary">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">Vestigingen</p>
              <p className="text-xs text-muted-foreground">
                {orgContext.locations.length} locatie{orgContext.locations.length === 1 ? "" : "s"} · beheer locaties en abonnementen.
              </p>
            </div>
          </div>
          <Link href="/organisatie/vestigingen">
            <Button size="sm" variant="outline">Beheren</Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Organisatiegegevens</CardTitle>
          <CardDescription>
            Contactgegevens worden pas met instructeurs gedeeld na een
            bevestigde opdracht.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <OrganizationForm organization={orgContext.organization} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Vaste aanname melden</CardTitle>
          <CardDescription>
            Heb je een instructeur die je via het platform hebt leren kennen
            binnen 6 maanden vast aangenomen? Meld het hier. Er geldt een
            eenmalige conversievergoeding van € 50 (excl. btw).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {knownInstructors.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Zodra je bevestigde opdrachten met instructeurs hebt gehad, kun je
              hier een vaste aanname melden.
            </p>
          ) : (
            <ConversionFeeForm instructors={knownInstructors} />
          )}

          {fees.length > 0 ? (
            <div className="space-y-0 border-t border-border pt-3">
              <p className="pb-2 text-sm font-medium">Eerdere meldingen</p>
              {fees.map((fee) => (
                <div
                  className="flex items-center justify-between gap-3 border-t border-border py-2.5 text-sm first:border-t-0"
                  key={fee.id}
                >
                  <span className="text-muted-foreground">
                    {new Date(fee.created_at).toLocaleDateString("nl-NL")}
                    {fee.note ? ` — ${fee.note}` : ""}
                  </span>
                  <Badge variant="muted">
                    {conversionFeeStatusLabels[fee.status]}
                  </Badge>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
