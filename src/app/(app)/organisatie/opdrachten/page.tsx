import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSessionProfile } from "@/lib/auth/session";
import { formatDate, formatTime, jobStatusLabels, jobTypeLabels } from "@/lib/labels";
import { getOrgContext } from "@/lib/org/context";
import { resolveLocationFilter } from "@/lib/org/location-filter";
import { createClient } from "@/lib/supabase/server";
import type { Job, JobStatus } from "@/types/database";

export const metadata: Metadata = {
  title: "Opdrachten beheren",
};

interface JobRow extends Job {
  sport: { name: string } | null;
  location: { name: string } | null;
  applications: { count: number }[];
  confirmations: {
    id: string;
    confirmed_at: string | null;
    cancelled_at: string | null;
  }[];
}

const statusVariant: Record<
  JobStatus,
  "secondary" | "success" | "muted" | "destructive" | "outline"
> = {
  open: "secondary",
  confirmed: "success",
  completed: "muted",
  cancelled: "destructive",
  closed: "outline",
};

const organizationJobFlow = [
  "Plaats eerst één concrete opdracht met duidelijke vergoeding en tijden.",
  "Bekijk reacties per opdracht en vergelijk kandidaten op beschikbaarheid en vertrouwen.",
  "Sluit de opdracht zodra iemand bevestigd is, zodat het overzicht actueel blijft.",
];

export default async function OrganisatieOpdrachtenPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const profile = await getSessionProfile();
  const orgContext = await getOrgContext();
  const supabase = await createClient();

  if (!profile || !supabase) {
    redirect("/login");
  }

  if (!orgContext) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const selectedLocationId = await resolveLocationFilter(
    orgContext.locations,
    params.location,
  );
  const selectedLocation = orgContext.locations.find(
    (location) => location.id === selectedLocationId,
  );
  let query = supabase
    .from("jobs")
    .select(
      `*,
      sport:sports (name),
      location:organization_locations (name),
      applications:job_applications (count),
      confirmations:job_confirmations (id, confirmed_at, cancelled_at)`,
    )
    .eq("organization_id", orgContext.organization.id)
    .order("created_at", { ascending: false });

  if (selectedLocationId) {
    query = query.eq("location_id", selectedLocationId);
  }

  const { data } = await query;

  const jobs = ((data as unknown as JobRow[] | null) ?? []).sort((left, right) => {
    const priority = (job: JobRow) => {
      const applicationCount = job.applications?.[0]?.count ?? 0;
      const pendingConfirmation = job.confirmations?.some(
        (confirmation) => !confirmation.cancelled_at && !confirmation.confirmed_at,
      );

      if (job.status === "open" && pendingConfirmation) return 0;
      if (job.status === "open" && applicationCount > 0) return 1;
      if (job.status === "open") return 2;
      if (job.status === "confirmed") return 3;
      if (job.status === "completed") return 4;
      if (job.status === "closed") return 5;
      return 6;
    };

    const priorityDifference = priority(left) - priority(right);
    if (priorityDifference !== 0) return priorityDifference;

    const dateDifference = left.starts_on.localeCompare(right.starts_on);
    return priority(left) >= 4 ? -dateDifference : dateDifference;
  });

  const workflowStatus = (job: JobRow) => {
    const applicationCount = job.applications?.[0]?.count ?? 0;
    const pendingConfirmation = job.confirmations?.some(
      (confirmation) => !confirmation.cancelled_at && !confirmation.confirmed_at,
    );

    if (job.status === "open" && pendingConfirmation) {
      return { label: "Wacht op bevestiging", variant: "warning" as const };
    }
    if (job.status === "open" && applicationCount > 0) {
      return { label: "Reacties bekijken", variant: "warning" as const };
    }
    if (job.status === "open") {
      return { label: "Nog zoeken", variant: "secondary" as const };
    }

    return {
      label: jobStatusLabels[job.status],
      variant: statusVariant[job.status],
    };
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Opdrachten</h1>
          <p className="text-sm text-muted-foreground">
            {selectedLocation
              ? `Opdrachten en vacatures van ${selectedLocation.name}.`
              : `Alle opdrachten en vacatures van ${orgContext.organization.name}.`}
          </p>
        </div>
        <Link href="/organisatie/opdrachten/nieuw">
          <Button>
            <Plus className="h-4 w-4" /> Nieuwe opdracht
          </Button>
        </Link>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-5">
          <p className="text-sm font-medium text-primary">
            Startflow voor sportscholen
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Dit overzicht laat zien wat openstaat, hoeveel reacties er zijn en
            welke opdracht opvolging nodig heeft.
          </p>
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {organizationJobFlow.map((item) => (
              <p
                className="flex gap-2 rounded-md border border-border bg-background p-3 text-sm leading-6"
                key={item}
              >
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                <span>{item}</span>
              </p>
            ))}
          </div>
        </CardContent>
      </Card>

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div>
              <p className="font-medium">Plaats je eerste opdracht</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Begin met een concrete invaldienst, lessenreeks of vacature. Je
                kunt daarna reacties vergelijken vanuit dit overzicht.
              </p>
            </div>
            <Link href="/organisatie/opdrachten/nieuw">
              <Button>Eerste opdracht plaatsen</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Opdracht</TableHead>
                <TableHead>Soort</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Vestiging</TableHead>
                <TableHead>Reacties</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => {
                const workflow = workflowStatus(job);

                return (
                <TableRow key={job.id}>
                  <TableCell>
                    <Link
                      className="font-medium text-primary hover:underline"
                      href={`/organisatie/opdrachten/${job.id}`}
                    >
                      {job.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {job.sport?.name}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm">
                    {jobTypeLabels[job.job_type]}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(job.starts_on)}
                    <p className="text-xs text-muted-foreground">
                      {formatTime(job.start_time)}–{formatTime(job.end_time)}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm">{job.location?.name}</TableCell>
                  <TableCell className="text-sm">
                    {job.applications?.[0]?.count ?? 0}
                  </TableCell>
                  <TableCell>
                    <Badge variant={workflow.variant}>
                      {workflow.label}
                    </Badge>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
