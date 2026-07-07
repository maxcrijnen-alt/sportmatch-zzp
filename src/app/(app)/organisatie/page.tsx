import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, Users } from "lucide-react";
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
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <Building2 className="mb-1 h-6 w-6 text-primary" />
            <CardTitle>Vestigingen ({orgContext.locations.length})</CardTitle>
            <CardDescription>
              Beheer je locaties en hun abonnementen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/organisatie/vestigingen">
              <Button variant="outline">Vestigingen beheren</Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Users className="mb-1 h-6 w-6 text-primary" />
            <CardTitle>Medewerkers</CardTitle>
            <CardDescription>
              Eigen logins voor planners en vestigingsmanagers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/organisatie/medewerkers">
              <Button variant="outline">Medewerkers beheren</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organisatiegegevens</CardTitle>
          <CardDescription>
            Contactgegevens worden pas met instructeurs gedeeld na een
            bevestigde opdracht.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrganizationForm organization={orgContext.organization} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vaste aanname melden</CardTitle>
          <CardDescription>
            Heb je een instructeur die je via het platform hebt leren kennen
            binnen 6 maanden vast aangenomen? Meld het hier. Er geldt een
            eenmalige conversievergoeding van € 50 (excl. btw).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {knownInstructors.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Zodra je bevestigde opdrachten met instructeurs hebt gehad, kun je
              hier een vaste aanname melden.
            </p>
          ) : (
            <ConversionFeeForm instructors={knownInstructors} />
          )}

          {fees.length > 0 ? (
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-sm font-medium">Eerdere meldingen</p>
              {fees.map((fee) => (
                <div
                  className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
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
