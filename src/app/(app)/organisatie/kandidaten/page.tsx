import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSessionProfile } from "@/lib/auth/session";
import { formatDate } from "@/lib/labels";
import { getOrgContext } from "@/lib/org/context";
import { resolveLocationFilter } from "@/lib/org/location-filter";
import { createClient } from "@/lib/supabase/server";
import type { InstructorPublicStats, JobApplication } from "@/types/database";

export const metadata: Metadata = {
  title: "Kandidaten",
};

interface ApplicationRow extends JobApplication {
  job: { id: string; title: string; starts_on: string; location_id: string } | null;
}

const candidateReviewTips = [
  "Vergelijk eerst beschikbaarheid, tarief en afstand voor de specifieke opdracht.",
  "Gebruik badges, betrouwbaarheid en berichttekst als extra vertrouwen voordat je bevestigt.",
  "Open de opdracht om de kandidaat in context te bekijken en de volgende stap te nemen.",
];

export default async function KandidatenPage({
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
  let applicationsQuery = supabase
    .from("job_applications")
    .select("*, job:jobs!inner (id, title, starts_on, organization_id, location_id)")
    .eq("job.organization_id", orgContext.organization.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (selectedLocationId) {
    applicationsQuery = applicationsQuery.eq(
      "job.location_id",
      selectedLocationId,
    );
  }

  const [{ data }, priorResult, openJobsResult] = await Promise.all([
    applicationsQuery,
    supabase
      .from("job_confirmations")
      .select("instructor_id, job:jobs!inner(id,organization_id,location_id,status)")
      .eq("job.organization_id", orgContext.organization.id)
      .eq("job.status", "completed"),
    supabase
      .from("jobs")
      .select("id,sport_id,location_id")
      .eq("organization_id", orgContext.organization.id)
      .eq("status", "open"),
  ]);

  const applications = (data as unknown as ApplicationRow[] | null) ?? [];

  const workedBeforeIds = Array.from(
    new Set(
      ((priorResult.data as unknown as { instructor_id: string; job: { location_id: string } | null }[] | null) ?? [])
        .filter((item) => !selectedLocationId || item.job?.location_id === selectedLocationId)
        .map((item) => item.instructor_id),
    ),
  );
  const openJobs = ((openJobsResult.data as { id: string; sport_id: string; location_id: string }[] | null) ?? [])
    .filter((job) => !selectedLocationId || job.location_id === selectedLocationId);
  const openSportIds = Array.from(new Set(openJobs.map((job) => job.sport_id)));
  const { data: matchingSports } = openSportIds.length
    ? await supabase
        .from("instructor_sports")
        .select("user_id,sport_id")
        .in("sport_id", openSportIds)
        .limit(100)
    : { data: [] };
  const appliedIds = new Set(applications.map((application) => application.instructor_id));
  const matchRows = ((matchingSports as { user_id: string; sport_id: string }[] | null) ?? [])
    .filter((item) => !appliedIds.has(item.user_id));
  const uniqueMatchIds = Array.from(new Set(matchRows.map((item) => item.user_id)));
  const vogChecks = await Promise.all(
    uniqueMatchIds.map(async (userId) => ({
      userId,
      result: await supabase.rpc("has_valid_vog", { target_user: userId }),
    })),
  );
  const eligibleMatchIds = vogChecks
    .filter((item) => item.result.data === true)
    .map((item) => item.userId)
    .slice(0, 12);
  const instructorIds = Array.from(
    new Set([
      ...applications.map((application) => application.instructor_id),
      ...workedBeforeIds,
      ...eligibleMatchIds,
    ]),
  );

  const namesById = new Map<string, { name: string; avatar: string | null }>();
  if (instructorIds.length > 0) {
    const { data: instructorProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", instructorIds);
    for (const row of instructorProfiles ?? []) {
      namesById.set(row.id as string, {
        name: row.full_name as string,
        avatar: row.avatar_url as string | null,
      });
    }
  }

  const statsEntries = await Promise.all(
    instructorIds.map(async (instructorId) => {
      const { data: statsData } = await supabase.rpc("instructor_public_stats", {
        target: instructorId,
      });
      return [
        instructorId,
        ((statsData as InstructorPublicStats[] | null) ?? [])[0] ?? null,
      ] as const;
    }),
  );
  const statsById = new Map(statsEntries);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Kandidaten</h1>
        <p className="text-sm text-muted-foreground">
          Alle openstaande reacties op jullie opdrachten, klaar om te
          vergelijken{selectedLocation ? ` voor ${selectedLocation.name}` : ""}.
        </p>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-5">
          <p className="text-sm font-medium text-primary">
            Zo kies je sneller de juiste instructeur
          </p>
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {candidateReviewTips.map((tip) => (
              <p
                className="flex gap-2 rounded-md border border-border bg-background p-3 text-sm leading-6"
                key={tip}
              >
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                <span>{tip}</span>
              </p>
            ))}
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Eerder mee samengewerkt</h2>
          <p className="text-sm text-muted-foreground">Instructeurs met een succesvol afgeronde opdracht bij jullie sportschool.</p>
        </div>
        {workedBeforeIds.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Nog geen eerdere samenwerkingen in deze selectie.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {workedBeforeIds.map((instructorId) => {
              const instructor = namesById.get(instructorId);
              const stats = statsById.get(instructorId);
              return (
                <Card key={instructorId}><CardContent className="flex items-center gap-3 pt-5">
                  <Avatar name={instructor?.name ?? "?"} src={instructor?.avatar} />
                  <div><p className="font-medium">{instructor?.name}</p><p className="text-xs text-muted-foreground">{stats?.completed_count ?? 0} afgerond · {stats?.review_count ?? 0} reviews</p></div>
                </CardContent></Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div><h2 className="text-lg font-semibold">Reacties</h2><p className="text-sm text-muted-foreground">Instructeurs die daadwerkelijk op een open opdracht hebben gereageerd.</p></div>
      {applications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Users className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Nog geen openstaande reacties</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Plaats of verbeter je opdracht. Duidelijke tijden, vergoeding,
                locatie en kwalificaties maken reageren makkelijker.
              </p>
            </div>
            <Link href="/organisatie/opdrachten/nieuw">
              <Button variant="outline">Nieuwe opdracht</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {applications.map((application) => {
            const instructor = namesById.get(application.instructor_id);
            const stats = statsById.get(application.instructor_id);

            return (
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"
                key={application.id}
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    name={instructor?.name ?? "?"}
                    src={instructor?.avatar}
                  />
                  <div>
                    <p className="font-medium">{instructor?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Voor:{" "}
                      <Link
                        className="text-primary hover:underline"
                        href={`/organisatie/opdrachten/${application.job?.id}`}
                      >
                        {application.job?.title}
                      </Link>{" "}
                      · {application.job ? formatDate(application.job.starts_on) : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {stats?.avg_rating != null ? (
                    <Badge variant="accent">★ {stats.avg_rating}</Badge>
                  ) : (
                    <Badge variant="muted">Eerste klus</Badge>
                  )}
                  {stats && stats.reliability_score != null ? (
                    <Badge variant="outline">
                      Betrouwbaarheid {stats.reliability_score}%
                    </Badge>
                  ) : null}
                  {stats ? <Badge variant="outline">{stats.review_count} reviews · {stats.completed_count} afgerond</Badge> : null}
                  <Link href={`/organisatie/opdrachten/${application.job?.id}`}>
                    <Button size="sm" variant="outline">
                      Bekijken
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </section>

      <section className="space-y-3">
        <div><h2 className="text-lg font-semibold">Passende instructeurs</h2><p className="text-sm text-muted-foreground">Nog niet gereageerd, passend op sport en met een goedgekeurde VOG. Lege beschikbaarheid sluit niemand uit.</p></div>
        {eligibleMatchIds.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Geen extra passende instructeurs gevonden.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {eligibleMatchIds.map((instructorId) => {
              const instructor = namesById.get(instructorId);
              const stats = statsById.get(instructorId);
              const sportIds = matchRows.filter((item) => item.user_id === instructorId).map((item) => item.sport_id);
              const targetJob = openJobs.find((job) => sportIds.includes(job.sport_id));
              return (
                <Card key={instructorId}><CardContent className="space-y-3 pt-5">
                  <div className="flex items-center gap-3"><Avatar name={instructor?.name ?? "?"} src={instructor?.avatar} /><div><p className="font-medium">{instructor?.name}</p>{stats?.review_count ? <p className="text-xs text-muted-foreground">★ {stats.avg_rating} · {stats.review_count} reviews · {stats.completed_count} afgerond</p> : <Badge variant="muted">Eerste klus</Badge>}</div></div>
                  {targetJob ? <Link href={`/organisatie/opdrachten/${targetJob.id}`}><Button size="sm" variant="outline">Bekijken en uitnodigen</Button></Link> : null}
                </CardContent></Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
