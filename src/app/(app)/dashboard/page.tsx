import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Inbox,
  MessageSquare,
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
import { createClient } from "@/lib/supabase/server";
import type { Subscription } from "@/types/database";

export const metadata: Metadata = {
  title: "Dashboard",
};

const instructorNextActions = [
  {
    title: "Check profiel, reisafstand en tarief",
    text: "Je profiel bepaalt welke opdrachten logisch bovenaan staan en hoe sportscholen jou beoordelen.",
    href: "/profiel",
    cta: "Profiel openen",
  },
  {
    title: "Bekijk passende opdrachten",
    text: "Start met opdrachten binnen je reisafstand en filter daarna op sport, datum of vergoeding.",
    href: "/opdrachten",
    cta: "Opdrachten bekijken",
  },
  {
    title: "Volg reacties en uitnodigingen",
    text: "Bekijk open reacties, bevestigingen en gesprekken zodat geen opvolging blijft hangen.",
    href: "/mijn-reacties",
    cta: "Mijn reacties",
  },
];

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
      </div>
    );
  }

  // Instructeur
  const [subscriptionResult, applicationsResult, confirmationsResult, chatsResult] =
    await Promise.all([
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
        .from("job_confirmations")
        .select("id", { count: "exact", head: true })
        .eq("instructor_id", profile.id)
        .not("confirmed_at", "is", null),
      supabase
        .from("chats")
        .select("id", { count: "exact", head: true })
        .eq("instructor_id", profile.id),
    ]);

  const subscription = subscriptionResult.data as Subscription | null;
  const hasAccess = subscriptionGrantsAccess(subscription);
  const pendingApplicationCount = applicationsResult.count ?? 0;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Hoi {profile.full_name.split(" ")[0]}!
        </h1>
        <p className="text-sm text-muted-foreground">
          Je startpunt voor profiel, passende opdrachten, reacties en gesprekken.
          Begin met je profiel en open daarna opdrachten die echt passen.
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
          <div>
            <p className="text-sm font-medium text-primary">
              Start hier als instructeur
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">
              {pendingApplicationCount > 0
                ? "Volg je open reacties en reageer snel op opvolging."
                : "Check je profiel en open daarna passende opdrachten."}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              De snelste route naar waarde: zet reisafstand, tarief en
              specialisaties goed, bekijk opdrachten binnen je voorkeuren en
              reageer alleen wanneer tijd, locatie en vergoeding kloppen.
            </p>
          </div>
          <Link href={pendingApplicationCount > 0 ? "/mijn-reacties" : "/opdrachten"}>
            <Button className="w-full sm:w-auto">
              {pendingApplicationCount > 0 ? "Mijn reacties" : "Opdrachten bekijken"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {instructorNextActions.map((action) => (
            <div
              className="rounded-lg border border-border bg-background p-4"
              key={action.title}
            >
              <CheckCircle2 className="mb-3 h-5 w-5 text-primary" />
              <h3 className="font-semibold">{action.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {action.text}
              </p>
              <Link
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                href={action.href}
              >
                {action.cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Openstaande reacties</CardDescription>
            <CardTitle className="text-3xl">
              {pendingApplicationCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              href="/mijn-reacties"
            >
              <Inbox className="h-3.5 w-3.5" /> Mijn reacties
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Bevestigde opdrachten</CardDescription>
            <CardTitle className="text-3xl">
              {confirmationsResult.count ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              href="/mijn-reacties"
            >
              <CalendarCheck className="h-3.5 w-3.5" /> Bekijken
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Gesprekken</CardDescription>
            <CardTitle className="text-3xl">{chatsResult.count ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              href="/berichten"
            >
              <MessageSquare className="h-3.5 w-3.5" /> Berichten
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
