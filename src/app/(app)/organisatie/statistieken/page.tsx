import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarCheck2, CircleCheckBig, MessageSquareReply, Search } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionProfile } from "@/lib/auth/session";
import { getOrgContext } from "@/lib/org/context";
import { resolveLocationFilter } from "@/lib/org/location-filter";
import { createClient } from "@/lib/supabase/server";
import type { JobStatus } from "@/types/database";

export const metadata: Metadata = {
  title: "Statistieken",
};

interface StatisticsPageProps {
  searchParams: Promise<{ location?: string }>;
}
export default async function OrganizationStatisticsPage({
  searchParams,
}: StatisticsPageProps) {
  const [profile, orgContext, supabase] = await Promise.all([
    getSessionProfile(),
    getOrgContext(),
    createClient(),
  ]);

  if (!profile || !supabase) {
    redirect("/login");
  }
  if (profile.role !== "organization" || !orgContext) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const locationId = await resolveLocationFilter(
    orgContext.locations,
    params.location,
  );
  const selectedLocation = orgContext.locations.find(
    (location) => location.id === locationId,
  );

  let jobsQuery = supabase
    .from("jobs")
    .select("id, status")
    .eq("organization_id", orgContext.organization.id);
  let applicationsQuery = supabase
    .from("job_applications")
    .select("id, job:jobs!inner(organization_id, location_id)", {
      count: "exact",
      head: true,
    })
    .eq("job.organization_id", orgContext.organization.id);

  if (locationId) {
    jobsQuery = jobsQuery.eq("location_id", locationId);
    applicationsQuery = applicationsQuery.eq("job.location_id", locationId);
  }

  const [jobsResult, applicationsResult] = await Promise.all([
    jobsQuery,
    applicationsQuery,
  ]);
  const jobs =
    (jobsResult.data as { id: string; status: JobStatus }[] | null) ?? [];
  const countStatus = (status: JobStatus) =>
    jobs.filter((job) => job.status === status).length;
  const cards = [
    {
      label: "Open opdrachten",
      value: countStatus("open"),
      icon: Search,
    },
    {
      label: "Bevestigde opdrachten",
      value: countStatus("confirmed"),
      icon: CalendarCheck2,
    },
    {
      label: "Afgeronde opdrachten",
      value: countStatus("completed"),
      icon: CircleCheckBig,
    },
    {
      label: "Ontvangen reacties",
      value: applicationsResult.count ?? 0,
      icon: MessageSquareReply,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Statistieken</h1>
        <p className="text-sm text-muted-foreground">
          {selectedLocation
            ? `Actuele aantallen voor ${selectedLocation.name}.`
            : "Actuele aantallen voor alle vestigingen."}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="gap-1 p-3">
              <div className="flex items-center justify-between gap-3">
                <CardDescription className="text-xs">{card.label}</CardDescription>
                <card.icon className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-2xl">{card.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        Alleen gegevens die in SportMatch zijn vastgelegd tellen mee. Externe
        planning- of omzetgegevens worden niet geschat.
      </p>
    </div>
  );
}
