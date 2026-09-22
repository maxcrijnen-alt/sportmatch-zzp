import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, SearchX } from "lucide-react";
import { AgendaView } from "@/components/agenda/agenda-view";
import { JobCard } from "@/components/jobs/job-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Opdrachten</h1>
          <p className="text-sm text-muted-foreground">
            {showAll
              ? "Alle open opdrachten, ook buiten je reisafstand."
              : "Passende opdrachten binnen jouw reisafstand, gesorteerd op match."}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/profiel">
            <Button className="w-full sm:w-auto" variant="outline">
              Profiel en tarief
            </Button>
          </Link>
          <Link href="/opdrachten?weergave=alles">
            <Button className="w-full sm:w-auto" variant="outline">
              Alle opdrachten
            </Button>
          </Link>
        </div>
      </div>

      {profile.role === "instructor" ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Mijn week</h2>
            <p className="text-sm text-muted-foreground">
              Je geplande, bevestigde en afgeronde opdrachten in weekoverzicht.
            </p>
          </div>
          <AgendaView
            defaultView="week"
            events={agendaEvents}
            exportHref="/agenda/export"
            role="instructor"
          />
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Filters</h2>
          {hasFilters ? (
            <Link
              className="text-sm font-medium text-primary hover:underline"
              href="/opdrachten"
            >
              Wissen
            </Link>
          ) : null}
        </div>
        <Card>
          <CardContent className="pt-5">
          <form className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6" method="get">
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="sport">
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
              <Label className="text-xs" htmlFor="type">
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
              <Label className="text-xs" htmlFor="datum">
                Datum
              </Label>
              <Input
                defaultValue={filters.datum ?? ""}
                id="datum"
                name="datum"
                type="date"
              />
              <p className="text-[11px] leading-4 text-muted-foreground">
                Laat leeg om alle datums te bekijken.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="maxkm">
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
              <Label className="text-xs" htmlFor="minbedrag">
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
              <Label className="text-xs" htmlFor="weergave">
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
            <div className="flex flex-col gap-2 sm:col-span-3 sm:flex-row lg:col-span-6">
              <Button className="w-full sm:w-auto" size="sm" type="submit" variant="outline">
                Filteren
              </Button>
            </div>
          </form>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Beschikbare opdrachten
          </h2>
          <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            {filtered.length}
          </span>
        </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <SearchX className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Geen opdrachten gevonden</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Probeer minder filters, bekijk alle opdrachten of pas je profiel,
                reisafstand en minimale vergoeding aan.
              </p>
            </div>
            <div className="flex w-full flex-col justify-center gap-2 sm:w-auto sm:flex-row">
              <Link href="/profiel">
                <Button className="w-full sm:w-auto" variant="outline">
                  Profiel aanpassen
                </Button>
              </Link>
              <Link href="/opdrachten">
                <Button className="w-full sm:w-auto" variant="outline">
                  Filters wissen
                </Button>
              </Link>
              <Link href="/opdrachten?weergave=alles">
                <Button className="w-full sm:w-auto">
                  Alle opdrachten bekijken
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
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
    </div>
  );
}
