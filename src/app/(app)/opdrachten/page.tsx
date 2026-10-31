import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, SearchX, SlidersHorizontal } from "lucide-react";
import { AgendaView } from "@/components/agenda/agenda-view";
import { JobCard } from "@/components/jobs/job-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Page, PageHeader, SectionHeading } from "@/components/ui/page";
import { Select } from "@/components/ui/select";
import { TabLinks } from "@/components/ui/tabs";
import { sportMatchAgendaProvider } from "@/lib/agenda/sportmatch-provider";
import { getSessionProfile } from "@/lib/auth/session";
import { jobTypeLabels } from "@/lib/labels";
import { fetchOpenJobsWithMatches } from "@/lib/jobs/queries";
import { createClient } from "@/lib/supabase/server";
import type { JobType, Sport } from "@/types/database";

export const metadata: Metadata = {
  title: "Opdrachten",
};

interface Filters {
  sport?: string;
  type?: string;
  maxkm?: string;
  datum?: string;
  minbedrag?: string;
  weergave?: string;
}

export default async function OpdrachtenPage({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile || !supabase) {
    redirect("/login");
  }

  const filters = await searchParams;
  const showAll = filters.weergave === "alles";
  const hasFilters = Boolean(
    filters.sport ||
      filters.type ||
      filters.maxkm ||
      filters.datum ||
      filters.minbedrag ||
      showAll,
  );

  const [{ jobs, matches }, sportsResult, applicationsResult, agendaEvents] =
    await Promise.all([
      fetchOpenJobsWithMatches(),
      supabase.from("sports").select("*").eq("is_active", true).order("name"),
      supabase
        .from("job_applications")
        .select("job_id")
        .eq("instructor_id", profile.id),
      profile.role === "instructor"
        ? sportMatchAgendaProvider.listEvents({
            role: "instructor",
            userId: profile.id,
          })
        : Promise.resolve([]),
    ]);

  const sports = (sportsResult.data as Sport[] | null) ?? [];
  const appliedJobIds = new Set(
    (applicationsResult.data ?? []).map((application) => application.job_id as string),
  );

  const filtered = jobs
    .filter((job) => {
      const match = matches.get(job.id);

      if (!showAll && match?.within_travel_distance === false) {
        return false;
      }
      if (filters.sport && job.sport_id !== filters.sport) {
        return false;
      }
      if (filters.type && job.job_type !== filters.type) {
        return false;
      }
      if (filters.datum && job.starts_on !== filters.datum) {
        return false;
      }
      if (filters.maxkm && match?.distance_km != null) {
        if (match.distance_km > Number(filters.maxkm)) {
          return false;
        }
      }
      if (filters.minbedrag) {
        const minCents = Number(filters.minbedrag) * 100;
        const best = Math.max(
          job.pay_amount_cents ?? 0,
          job.pay_hourly_rate_cents ?? 0,
        );
        if (best < minCents) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      // spoed eerst, daarna matchscore
      const urgencyDiff =
        Number(b.job_type === "urgent_substitute") -
        Number(a.job_type === "urgent_substitute");
      if (urgencyDiff !== 0) {
        return urgencyDiff;
      }
      return (
        (matches.get(b.id)?.match_score ?? 0) -
        (matches.get(a.id)?.match_score ?? 0)
      );
    });

  return (
    <Page>
      <PageHeader
        actions={
          <Link
            href="/profiel"
            className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}
          >
            Profiel en tarief
          </Link>
        }
        title="Opdrachten"
      />

      {profile.role === "instructor" ? (
        <section className="space-y-3">
          <SectionHeading title="Mijn week" />
          <AgendaView
            defaultView="week"
            events={agendaEvents}
            exportHref="/agenda/export"
            role="instructor"
          />
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionHeading
          actions={
            hasFilters ? (
              <Link
                className="text-[13px] font-medium text-primary hover:underline"
                href="/opdrachten"
              >
                Wissen
              </Link>
            ) : null
          }
          title="Filters"
        />
        <Card>
          <form
            className="grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-[repeat(6,minmax(0,1fr))_auto] lg:items-end"
            method="get"
          >
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="sport">
                Sport
              </Label>
              <Select defaultValue={filters.sport ?? ""} id="sport" name="sport">
                <option value="">Alle sporten</option>
                {sports.map((sport) => (
                  <option key={sport.id} value={sport.id}>
                    {sport.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="type">
                Soort
              </Label>
              <Select defaultValue={filters.type ?? ""} id="type" name="type">
                <option value="">Alle soorten</option>
                {(Object.entries(jobTypeLabels) as [JobType, string][]).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="datum">
                Datum
              </Label>
              <Input
                defaultValue={filters.datum ?? ""}
                id="datum"
                name="datum"
                type="date"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="maxkm">
                Max. km
              </Label>
              <Input
                defaultValue={filters.maxkm ?? ""}
                id="maxkm"
                min={1}
                name="maxkm"
                placeholder="25"
                type="number"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="minbedrag">
                Min. €
              </Label>
              <Input
                defaultValue={filters.minbedrag ?? ""}
                id="minbedrag"
                min={0}
                name="minbedrag"
                placeholder="40"
                type="number"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="weergave">
                Weergave
              </Label>
              <Select
                defaultValue={filters.weergave ?? ""}
                id="weergave"
                name="weergave"
              >
                <option value="">Passend bij mij</option>
                <option value="alles">Alle opdrachten</option>
              </Select>
            </div>
            <Button className="w-full sm:col-span-3 lg:col-span-1 lg:w-auto" type="submit" variant="secondary">
              <SlidersHorizontal className="h-4 w-4" />
              Filteren
            </Button>
          </form>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionHeading count={filtered.length} title="Beschikbare opdrachten" />
        <TabLinks
          items={[
            { href: "/opdrachten", label: "Passend bij mij", active: !showAll },
            {
              href: "/opdrachten?weergave=alles",
              label: "Alle opdrachten",
              active: showAll,
            },
          ]}
          label="Opdrachtweergave"
        />

        {filtered.length === 0 ? (
          <Card>
            <EmptyState
              action={
                <>
                  <Link
                    href="/profiel"
                    className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}
                  >
                    Profiel aanpassen
                  </Link>
                  <Link
                    href="/opdrachten"
                    className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}
                  >
                    Filters wissen
                  </Link>
                  <Link
                    href="/opdrachten?weergave=alles"
                    className={cn(buttonVariants(), "w-full sm:w-auto")}
                  >
                    Alle opdrachten bekijken
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </>
              }
              description="Probeer minder filters, bekijk alle opdrachten of pas je profiel, reisafstand en minimale vergoeding aan."
              icon={SearchX}
              title="Geen opdrachten gevonden"
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((job) => (
              <JobCard
                actionHref={
                  appliedJobIds.has(job.id)
                    ? `/opdrachten/${job.id}`
                    : `/opdrachten/${job.id}#aanmelden`
                }
                actionLabel={appliedJobIds.has(job.id) ? "Reactie bekijken" : "Aanmelden"}
                href={`/opdrachten/${job.id}`}
                job={job}
                key={job.id}
                match={matches.get(job.id)}
              />
            ))}
          </div>
        )}
      </section>
    </Page>
  );
}
