import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarCheck,
  Inbox,
  ShieldCheck,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionProfile } from "@/lib/auth/session";
import { subscriptionGrantsAccess } from "@/lib/billing/access";
import { getOrgContext } from "@/lib/org/context";
import { resolveLocationFilter } from "@/lib/org/location-filter";
import { formatDate, formatTime } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { Subscription } from "@/types/database";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile || !supabase) {
    redirect("/login");
  }

  if (!profile.onboarding_completed && profile.role !== "admin") {
    redirect("/onboarding");
  }

  if (profile.role === "admin") {
    redirect("/admin");
  }

  if (profile.role === "organization") {
    const orgContext = await getOrgContext();

    if (!orgContext) {
      redirect("/onboarding");
    }

    const params = await searchParams;
    const selectedLocationId = await resolveLocationFilter(
      orgContext.locations,
      params.location,
    );
    const locationIds = selectedLocationId
      ? [selectedLocationId]
      : orgContext.locations.map((location) => location.id);
    const selectedLocation = orgContext.locations.find(
      (location) => location.id === selectedLocationId,
    );

    let jobsQuery = supabase
      .from("jobs")
      .select("id, status")
      .eq("organization_id", orgContext.organization.id)
      .eq("status", "open");
    let applicationsQuery = supabase
      .from("job_applications")
      .select("id, job_id, job:jobs!inner(organization_id, location_id)")
      .eq("job.organization_id", orgContext.organization.id)
      .eq("status", "pending");

    if (selectedLocationId) {
      jobsQuery = jobsQuery.eq("location_id", selectedLocationId);
      applicationsQuery = applicationsQuery.eq(
        "job.location_id",
        selectedLocationId,
      );
    }

    const [jobsResult, subsResult, applicationsResult] = await Promise.all([
      jobsQuery,
      locationIds.length > 0
        ? supabase.from("subscriptions").select("*").in("location_id", locationIds)
        : Promise.resolve({ data: [] as Subscription[] }),
      applicationsQuery,
    ]);

    const subscriptions = (subsResult.data as Subscription[] | null) ?? [];
    const hasInactiveLocation = subscriptions.some(
      (subscription) => !subscriptionGrantsAccess(subscription),
    );
    const openJobs =
      (jobsResult.data as { id: string; status: string }[] | null) ?? [];
    const openJobIds = openJobs.map((job) => job.id);
    const pendingApplications =
      (applicationsResult.data as { id: string; job_id: string }[] | null) ?? [];
    const pendingApplicationJobIds = new Set(
      pendingApplications.map((application) => application.job_id),
    );

    const pendingConfirmationJobIds = new Set<string>();

    if (openJobIds.length > 0) {
      const [wholeConfirmationsResult, segmentConfirmationsResult] =
        await Promise.all([
          supabase
            .from("job_confirmations")
            .select("job_id")
            .in("job_id", openJobIds)
            .is("confirmed_at", null),
          supabase
            .from("job_segment_confirmations")
            .select("job_id")
            .in("job_id", openJobIds)
            .is("confirmed_at", null)
            .is("cancelled_at", null),
        ]);

      for (const confirmation of wholeConfirmationsResult.data ?? []) {
        pendingConfirmationJobIds.add(confirmation.job_id as string);
      }
      for (const confirmation of segmentConfirmationsResult.data ?? []) {
        pendingConfirmationJobIds.add(confirmation.job_id as string);
      }
    }

    const openJobCount = openJobs.length;
    const pendingApplicationCount = pendingApplications.length;
    const pendingConfirmationCount = pendingConfirmationJobIds.size;
    const searchingJobCount = openJobIds.filter(
      (jobId) =>
        !pendingApplicationJobIds.has(jobId) &&
        !pendingConfirmationJobIds.has(jobId),
    ).length;

    const primaryAction =
      pendingConfirmationCount > 0
        ? {
            title: "Bevestigingen opvolgen",
            text: `${pendingConfirmationCount} ${
              pendingConfirmationCount === 1 ? "opdracht wacht" : "opdrachten wachten"
            } nog op definitieve bevestiging van de instructeur.`,
            href: "/organisatie/opdrachten",
            cta: "Bekijk bevestigingen",
          }
        : pendingApplicationCount > 0
          ? {
              title: "Nieuwe reacties beoordelen",
              text: `${pendingApplicationCount} ${
                pendingApplicationCount === 1 ? "reactie staat" : "reacties staan"
              } klaar om te vergelijken en op te volgen.`,
              href: "/organisatie/kandidaten",
              cta: "Bekijk kandidaten",
            }
          : searchingJobCount > 0
            ? {
                title: "Nog iemand vinden",
                text: `${searchingJobCount} ${
                  searchingJobCount === 1 ? "open opdracht heeft" : "open opdrachten hebben"
                } nog geen reactie of gekozen instructeur.`,
                href: "/organisatie/opdrachten",
                cta: "Bekijk open opdrachten",
              }
            : {
                title: openJobCount > 0 ? "Alles is opgevolgd" : "Klaar voor een nieuwe opdracht",
                text:
                  openJobCount > 0
                    ? "Je open opdrachten hebben allemaal opvolging. Houd de agenda in de gaten voor de volgende stap."
                    : "Er staat nu niets open. Plaats een nieuwe opdracht zodra je weer iemand nodig hebt.",
                href: openJobCount > 0 ? "/agenda" : "/organisatie/opdrachten/nieuw",
                cta: openJobCount > 0 ? "Bekijk agenda" : "Nieuwe opdracht",
              };

    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {orgContext.organization.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {selectedLocation
              ? `Je startpunt voor opdrachten, kandidaten en planning van ${selectedLocation.name}.`
              : "Je startpunt voor opdrachten, kandidaten en planning van alle vestigingen."}
          </p>
        </div>

        {hasInactiveLocation ? (
          <Alert variant="warning">
            <AlertTitle>Niet alle vestigingen hebben actieve toegang</AlertTitle>
            <AlertDescription>
              Voor vestigingen zonder actief abonnement kun je geen nieuwe
              opdrachten plaatsen of bevestigen.{" "}
              <Link className="font-medium underline" href="/abonnement">
                Bekijk je abonnementen
              </Link>
              .
            </AlertDescription>
          </Alert>
        ) : null}

        <section className="rounded-lg border border-primary/30 bg-primary/5 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-medium text-primary">Wat vraagt aandacht?</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">
                {primaryAction.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {primaryAction.text}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Link href={primaryAction.href}>
                <Button className="w-full sm:w-auto">
                  {primaryAction.cta}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              {primaryAction.href !== "/organisatie/opdrachten/nieuw" ? (
                <Link href="/organisatie/opdrachten/nieuw">
                  <Button className="w-full sm:w-auto" variant="outline">
                    Nieuwe opdracht
                  </Button>
                </Link>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <Link
              className="rounded-lg border border-border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
              href="/organisatie/opdrachten"
            >
              <p className="text-sm font-medium text-muted-foreground">
                Nog iemand zoeken
              </p>
              <p className="mt-1 text-3xl font-bold tracking-tight">
                {searchingJobCount}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Open opdrachten zonder reactie of gekozen instructeur.
              </p>
            </Link>

            <Link
              className="rounded-lg border border-border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
              href="/organisatie/kandidaten"
            >
              <p className="text-sm font-medium text-muted-foreground">
                Reacties te beoordelen
              </p>
              <p className="mt-1 text-3xl font-bold tracking-tight">
                {pendingApplicationCount}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Nieuwe reacties waarvoor je nog een keuze kunt maken.
              </p>
            </Link>

            <Link
              className="rounded-lg border border-border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
              href="/organisatie/opdrachten"
            >
              <p className="text-sm font-medium text-muted-foreground">
                Wacht op bevestiging
              </p>
              <p className="mt-1 text-3xl font-bold tracking-tight">
                {pendingConfirmationCount}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Gekozen instructeurs die nog definitief moeten bevestigen.
              </p>
            </Link>
          </div>
        </section>
      </div>
    );
  }

  // Instructeur
  const today = new Date().toISOString().slice(0, 10);
  const [
    subscriptionResult,
    applicationsResult,
    invitationsResult,
    pendingConfirmationsResult,
    pendingSegmentConfirmationsResult,
    confirmedJobsResult,
    vogResult,
    instructorProfileResult,
  ] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("*")
      .eq("instructor_id", profile.id)
      .maybeSingle(),
    supabase
      .from("job_applications")
      .select("id", { count: "exact", head: true })
      .eq("instructor_id", profile.id)
      .eq("status", "pending"),
    supabase
      .from("job_invitations")
      .select("id", { count: "exact", head: true })
      .eq("instructor_id", profile.id)
      .eq("status", "pending"),
    supabase
      .from("job_confirmations")
      .select("job_id")
      .eq("instructor_id", profile.id)
      .not("organization_agreed_at", "is", null)
      .is("instructor_agreed_at", null)
      .is("confirmed_at", null),
    supabase
      .from("job_segment_confirmations")
      .select("job_id")
      .eq("instructor_id", profile.id)
      .not("organization_agreed_at", "is", null)
      .is("instructor_agreed_at", null)
      .is("confirmed_at", null)
      .is("cancelled_at", null),
    supabase
      .from("job_confirmations")
      .select(
        "job_id, job:jobs!inner(id, title, starts_on, start_time, status)",
      )
      .eq("instructor_id", profile.id)
      .not("confirmed_at", "is", null)
      .eq("job.status", "confirmed")
      .gte("job.starts_on", today),
    supabase
      .from("document_uploads")
      .select("status, expires_at, created_at")
      .eq("user_id", profile.id)
      .eq("doc_type", "vog")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("instructor_profiles")
      .select(
        "hourly_rate_cents, travel_distance_km, work_experience, years_experience",
      )
      .eq("user_id", profile.id)
      .maybeSingle(),
  ]);

  const subscription = subscriptionResult.data as Subscription | null;
  const hasAccess = subscriptionGrantsAccess(subscription);
  const pendingApplicationCount = applicationsResult.count ?? 0;
  const pendingInvitationCount = invitationsResult.count ?? 0;

  const pendingConfirmationJobIds = new Set<string>();
  for (const row of pendingConfirmationsResult.data ?? []) {
    pendingConfirmationJobIds.add(row.job_id as string);
  }
  for (const row of pendingSegmentConfirmationsResult.data ?? []) {
    pendingConfirmationJobIds.add(row.job_id as string);
  }
  const pendingConfirmationCount = pendingConfirmationJobIds.size;
  const firstPendingConfirmationJobId =
    Array.from(pendingConfirmationJobIds)[0] ?? null;

  type ConfirmedDashboardJob = {
    job_id: string;
    job: {
      id: string;
      title: string;
      starts_on: string;
      start_time: string;
      status: string;
    } | null;
  };

  const upcomingConfirmedJobs =
    (confirmedJobsResult.data as unknown as ConfirmedDashboardJob[] | null) ?? [];
  const nextConfirmedJob = upcomingConfirmedJobs
    .filter((row) => row.job)
    .sort((left, right) =>
      `${left.job!.starts_on}T${left.job!.start_time}`.localeCompare(
        `${right.job!.starts_on}T${right.job!.start_time}`,
      ),
    )[0]?.job ?? null;

  const latestVog = vogResult.data as
    | { status: string; expires_at: string | null; created_at: string }
    | null;
  const vogValid =
    latestVog?.status === "approved" &&
    (!latestVog.expires_at || latestVog.expires_at >= today);

  const instructorDetails = instructorProfileResult.data as
    | {
        hourly_rate_cents: number | null;
        travel_distance_km: number | null;
        work_experience: string | null;
        years_experience: number | null;
      }
    | null;

  const profileNeedsAttention =
    !profile.phone ||
    (!profile.city_id && !profile.custom_city) ||
    !instructorDetails?.hourly_rate_cents ||
    !instructorDetails?.travel_distance_km ||
    !instructorDetails?.work_experience;

  const primaryAction =
    pendingInvitationCount > 0
      ? {
          title: "Je hebt een nieuwe uitnodiging",
          text: `${pendingInvitationCount} ${
            pendingInvitationCount === 1 ? "sportschool wil" : "sportscholen willen"
          } je rechtstreeks boeken. Bekijk datum, locatie en vergoeding en reageer.`,
          href: "/mijn-reacties",
          cta: "Bekijk uitnodigingen",
        }
      : pendingConfirmationCount > 0
        ? {
            title: "Een sportschool heeft jou gekozen",
            text: `${pendingConfirmationCount} ${
              pendingConfirmationCount === 1 ? "opdracht wacht" : "opdrachten wachten"
            } nog op jouw definitieve bevestiging.`,
            href: firstPendingConfirmationJobId
              ? `/opdrachten/${firstPendingConfirmationJobId}`
              : "/mijn-reacties",
            cta: "Bevestiging bekijken",
          }
        : !vogValid
          ? {
              title: "Je VOG vraagt aandacht",
              text:
                latestVog?.status === "pending"
                  ? "Je VOG wacht nog op controle. Je kunt opdrachten bekijken, maar commerciële acties blijven beperkt totdat deze is goedgekeurd."
                  : "Zorg voor een geldige, goedgekeurde VOG zodat je kunt reageren, uitnodigingen accepteren en bevestigd kunt worden.",
              href: "/documenten",
              cta: "Bekijk documenten",
            }
          : profileNeedsAttention
            ? {
                title: "Maak je profiel completer",
                text:
                  "Vul je woonplaats, reisafstand, tarief en werkervaring zo volledig mogelijk in. Dat verbetert je matching en geeft sportscholen meer context.",
                href: "/profiel",
                cta: "Profiel aanvullen",
              }
            : pendingApplicationCount > 0
              ? {
                  title: "Je reacties lopen",
                  text: `${pendingApplicationCount} ${
                    pendingApplicationCount === 1 ? "reactie staat" : "reacties staan"
                  } nog open. Je hoeft niets opnieuw te versturen; houd opvolging en berichten in de gaten.`,
                  href: "/mijn-reacties",
                  cta: "Mijn reacties",
                }
              : nextConfirmedJob
                ? {
                    title: "Je volgende klus staat gepland",
                    text: `${nextConfirmedJob.title} · ${formatDate(
                      nextConfirmedJob.starts_on,
                    )} om ${formatTime(nextConfirmedJob.start_time)}.`,
                    href: `/opdrachten/${nextConfirmedJob.id}`,
                    cta: "Bekijk opdracht",
                  }
                : {
                    title: "Bekijk passende opdrachten",
                    text:
                      "Er staat nu geen actie voor je open. Bekijk opdrachten die passen bij je sport, reisafstand en voorkeuren.",
                    href: "/opdrachten",
                    cta: "Opdrachten bekijken",
                  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Hoi {profile.full_name.split(" ")[0]}!
        </h1>
        <p className="text-sm text-muted-foreground">
          Je overzicht voor uitnodigingen, reacties, bevestigingen en aankomende
          opdrachten.
        </p>
      </div>

      {!hasAccess ? (
        <Alert variant="warning">
          <AlertTitle>Je abonnement is niet actief</AlertTitle>
          <AlertDescription>
            Je kunt opdrachten bekijken, maar niet reageren of chatten.{" "}
            <Link className="font-medium underline" href="/abonnement">
              Bekijk je abonnement
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="rounded-lg border border-primary/30 bg-primary/5 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-primary">Wat vraagt aandacht?</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">
              {primaryAction.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {primaryAction.text}
            </p>
          </div>
          <Link href={primaryAction.href}>
            <Button className="w-full sm:w-auto">
              {primaryAction.cta}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <Link
            className="rounded-lg border border-border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
            href="/mijn-reacties"
          >
            <p className="text-sm font-medium text-muted-foreground">
              Uitnodigingen
            </p>
            <p className="mt-1 text-3xl font-bold tracking-tight">
              {pendingInvitationCount}
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Rechtstreekse verzoeken van sportscholen waarop je nog moet reageren.
            </p>
          </Link>

          <Link
            className="rounded-lg border border-border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
            href="/mijn-reacties"
          >
            <p className="text-sm font-medium text-muted-foreground">
              Open reacties
            </p>
            <p className="mt-1 text-3xl font-bold tracking-tight">
              {pendingApplicationCount}
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Opdrachten waarop je hebt gereageerd en nog geen uitkomst hebt.
            </p>
          </Link>

          <Link
            className="rounded-lg border border-border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
            href={
              firstPendingConfirmationJobId
                ? `/opdrachten/${firstPendingConfirmationJobId}`
                : "/mijn-reacties"
            }
          >
            <p className="text-sm font-medium text-muted-foreground">
              Wacht op jouw bevestiging
            </p>
            <p className="mt-1 text-3xl font-bold tracking-tight">
              {pendingConfirmationCount}
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Opdrachten waarvoor een sportschool jou al heeft gekozen.
            </p>
          </Link>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <CalendarCheck className="mt-0.5 h-5 w-5 text-primary" />
            <div className="min-w-0">
              <p className="font-semibold">Eerstvolgende bevestigde klus</p>
              {nextConfirmedJob ? (
                <>
                  <p className="mt-1 truncate text-sm font-medium">
                    {nextConfirmedJob.title}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDate(nextConfirmedJob.starts_on)} ·{" "}
                    {formatTime(nextConfirmedJob.start_time)}
                  </p>
                  <Link
                    className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    href={`/opdrachten/${nextConfirmedJob.id}`}
                  >
                    Bekijk opdracht
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </>
              ) : (
                <>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Er staat nu geen bevestigde toekomstige klus in je planning.
                  </p>
                  <Link
                    className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    href="/opdrachten"
                  >
                    Bekijk opdrachten
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck
              className={`mt-0.5 h-5 w-5 ${
                vogValid ? "text-primary" : "text-amber-600"
              }`}
            />
            <div>
              <p className="font-semibold">Profiel & VOG</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {vogValid
                  ? profileNeedsAttention
                    ? "Je VOG is goedgekeurd. Je profiel kan nog completer voor betere matching."
                    : "Je VOG is goedgekeurd en je basisprofiel is compleet."
                  : latestVog?.status === "pending"
                    ? "Je VOG wacht op beoordeling."
                    : "Je hebt nog geen geldige, goedgekeurde VOG."}
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <Link
                  className="font-medium text-primary hover:underline"
                  href="/documenten"
                >
                  Documenten
                </Link>
                <Link
                  className="font-medium text-primary hover:underline"
                  href="/profiel"
                >
                  Profiel
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
