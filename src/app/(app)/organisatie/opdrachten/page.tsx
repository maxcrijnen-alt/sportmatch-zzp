import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Briefcase,
  CalendarDays,
  ChevronRight,
  MapPin,
  Minus,
  Plus,
  Users,
} from "lucide-react";
import { AgendaView } from "@/components/agenda/agenda-view";
import { JobStatusIndicator } from "@/components/jobs/job-status-indicator";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Page, PageHeader, SectionHeading } from "@/components/ui/page";
import { sportMatchAgendaProvider } from "@/lib/agenda/sportmatch-provider";
import { getSessionProfile } from "@/lib/auth/session";
import { formatDate, formatTime, jobTypeLabels } from "@/lib/labels";
import { getOrgContext } from "@/lib/org/context";
import { resolveLocationFilter } from "@/lib/org/location-filter";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { Job } from "@/types/database";

export const metadata: Metadata = {
  title: "Opdrachten beheren",
};

interface JobRow extends Job {
  sport: { name: string } | null;
  location: { name: string } | null;
  applications: { count: number }[];
}

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
  let query = supabase
    .from("jobs")
    .select(
      `*,
      sport:sports (name),
      location:organization_locations (name),
      applications:job_applications (count)`,
    )
    .eq("organization_id", orgContext.organization.id)
    .order("created_at", { ascending: false });

  query = query.eq("applications.status", "pending");

  if (selectedLocationId) {
    query = query.eq("location_id", selectedLocationId);
  }

  const [{ data, error }, agendaEvents] = await Promise.all([
    query,
    sportMatchAgendaProvider.listEvents({
      role: "organization",
      userId: profile.id,
      organizationId: orgContext.organization.id,
      locationId: selectedLocationId,
      includeOpenPlanning: true,
    }),
  ]);
  const agendaExportHref = selectedLocationId
    ? `/agenda/export?location=${encodeURIComponent(selectedLocationId)}`
    : "/agenda/export";

  if (error) {
    console.error("Opdrachtenoverzicht kon niet worden geladen", error.message);
  }

  const baseJobs = (data as unknown as JobRow[] | null) ?? [];
  const jobIds = baseJobs.map((job) => job.id);
  const pendingConfirmationJobIds = new Set<string>();

  if (jobIds.length > 0) {
    const { data: confirmationData, error: confirmationError } = await supabase
      .from("job_confirmations")
      .select("job_id, confirmed_at")
      .in("job_id", jobIds);

    if (confirmationError) {
      console.error(
        "Bevestigingsstatussen konden niet worden geladen",
        confirmationError.message,
      );
    } else {
      for (const confirmation of confirmationData ?? []) {
        if (!confirmation.confirmed_at) {
          pendingConfirmationJobIds.add(confirmation.job_id as string);
        }
      }
    }
  }

  const priority = (job: JobRow) => {
    const applicationCount = job.applications?.[0]?.count ?? 0;

    if (job.status === "open" && pendingConfirmationJobIds.has(job.id)) return 0;
    if (job.status === "open" && applicationCount > 0) return 1;
    if (job.status === "open") return 2;
    if (job.status === "confirmed") return 3;
    if (job.status === "completed") return 4;
    if (job.status === "closed") return 5;
    return 6;
  };

  const jobs = [...baseJobs].sort((left, right) => {
    const priorityDifference = priority(left) - priority(right);
    if (priorityDifference !== 0) return priorityDifference;

    const dateDifference = left.starts_on.localeCompare(right.starts_on);
    return priority(left) >= 4 ? -dateDifference : dateDifference;
  });

  const workflowState = (job: JobRow) => {
    const applicationCount = job.applications?.[0]?.count ?? 0;

    if (job.status === "open" && pendingConfirmationJobIds.has(job.id)) {
      return "planned" as const;
    }
    if (job.status === "open" && applicationCount > 0) {
      return "action_required" as const;
    }
    if (job.status === "open") {
      return "searching" as const;
    }
    if (job.status === "confirmed") {
      return "confirmed" as const;
    }
    if (job.status === "completed") {
      return "completed" as const;
    }
    if (job.status === "cancelled") {
      return "cancelled" as const;
    }

    return null;
  };

  const stateLabels = {
    searching: "Nog iemand zoeken",
    action_required: "Reactie ontvangen",
    planned: "Wacht op bevestiging",
    confirmed: "Bevestigd",
    completed: "Afgerond",
    cancelled: "Geannuleerd",
  } as const;
  const stateTextClasses = {
    searching: "text-foreground",
    action_required: "text-foreground",
    planned: "text-foreground",
    confirmed: "text-foreground",
    completed: "text-muted-foreground",
    cancelled: "text-muted-foreground",
  } as const;

  return (
    <Page>
      <PageHeader
        actions={
          <Link href="/organisatie/opdrachten/nieuw">
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4" /> Nieuwe opdracht
            </Button>
          </Link>
        }
        title="Opdrachten"
      />

      <section className="space-y-3">
        <SectionHeading title="Weekoverzicht" />
        <AgendaView
          defaultView="week"
          events={agendaEvents}
          exportHref={agendaExportHref}
          role="organization"
        />
      </section>

      <section className="space-y-3">
        <SectionHeading count={jobs.length} title="Opdrachtenlijst" />

        {jobs.length === 0 ? (
          <Card>
            <EmptyState
              action={
                <Link href="/organisatie/opdrachten/nieuw">
                  <Button>Eerste opdracht plaatsen</Button>
                </Link>
              }
              description="Begin met een concrete invaldienst, lessenreeks of vacature. Je kunt daarna reacties vergelijken vanuit dit overzicht."
              icon={Briefcase}
              title="Plaats je eerste opdracht"
            />
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div
              aria-hidden="true"
              className="hidden grid-cols-[minmax(0,1fr)_10rem_10rem_8.5rem_1.25rem] gap-4 border-b border-border bg-subtle py-2.5 pl-16 pr-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid"
            >
              <span>Opdracht</span>
              <span>Datum</span>
              <span>Vestiging</span>
              <span>Reacties</span>
              <span />
            </div>
            <ul className="divide-y divide-border">
              {jobs.map((job) => {
                const state = workflowState(job);
                const applicationCount = job.applications?.[0]?.count ?? 0;

                return (
                  <li
                    className="group relative flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-subtle sm:px-5 md:items-center"
                    key={job.id}
                  >
                    {state ? (
                      <JobStatusIndicator className="mt-0.5 md:mt-0" showLabel={false} state={state} />
                    ) : (
                      <span
                        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border-strong bg-muted text-muted-foreground md:mt-0"
                        title="Gesloten"
                      >
                        <Minus aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={3} />
                        <span className="sr-only">Gesloten</span>
                      </span>
                    )}
                    <div className="grid min-w-0 flex-1 gap-x-4 gap-y-1 md:grid-cols-[minmax(0,1fr)_10rem_10rem_8.5rem] md:items-center">
                      <div className="min-w-0">
                        <Link
                          className="block truncate text-sm font-semibold text-foreground after:absolute after:inset-0 after:content-[''] focus-visible:outline-none group-hover:text-primary"
                          href={`/organisatie/opdrachten/${job.id}`}
                        >
                          {job.title}
                        </Link>
                        <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                          <span
                            aria-hidden="true"
                            className={cn(
                              "font-medium",
                              state ? stateTextClasses[state] : "text-muted-foreground",
                            )}
                          >
                            {state ? stateLabels[state] : "Gesloten"}
                          </span>
                          {job.sport?.name ? ` · ${job.sport.name}` : ""} ·{" "}
                          {jobTypeLabels[job.job_type]}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground md:block">
                        <p className="inline-flex items-center gap-1.5 text-foreground md:flex">
                          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground md:hidden" />
                          {formatDate(job.starts_on)}
                        </p>
                        <p className="tabular-nums">
                          {formatTime(job.start_time)}–{formatTime(job.end_time)}
                        </p>
                        <p className="inline-flex items-center gap-1.5 md:hidden">
                          <MapPin className="h-3.5 w-3.5" />
                          {job.location?.name}
                        </p>
                      </div>
                      <p className="hidden truncate text-[13px] text-foreground md:block">
                        {job.location?.name}
                      </p>
                      <div className="relative z-10 pt-1 md:pt-0">
                        {applicationCount > 0 && job.status === "open" ? (
                          <Link
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-status-pending/25 bg-orange-50 px-2.5 text-[13px] font-semibold text-orange-700 transition-colors hover:border-status-pending/50 hover:bg-orange-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                            href={`/organisatie/kandidaten?job=${job.id}${selectedLocationId ? `&location=${selectedLocationId}` : ""}`}
                          >
                            <Users className="h-3.5 w-3.5" />
                            {applicationCount} bekijken
                          </Link>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[13px] tabular-nums text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            {applicationCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight
                      aria-hidden="true"
                      className="mt-0.5 hidden h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground sm:block md:mt-0"
                    />
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>
    </Page>
  );
}
