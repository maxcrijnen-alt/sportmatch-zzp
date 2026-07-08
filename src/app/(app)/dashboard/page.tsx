import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Briefcase,
  CalendarCheck,
  CheckCircle2,
  Inbox,
  MessageSquare,
  Search,
  Users,
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
import { createClient } from "@/lib/supabase/server";
import type { Subscription } from "@/types/database";

export const metadata: Metadata = {
  title: "Dashboard",
};

const organizationNextActions = [
  {
    title: "Plaats je eerste opdracht",
    text: "Maak concreet wat je zoekt: sport, datum, tijd, vergoeding en locatie.",
    href: "/organisatie/opdrachten/nieuw",
    cta: "Opdracht plaatsen",
  },
  {
    title: "Vergelijk reacties",
    text: "Check beschikbaarheid, tarief, afstand, documenten en opmerkingen van kandidaten.",
    href: "/organisatie/kandidaten",
    cta: "Kandidaten bekijken",
  },
  {
    title: "Zet je team klaar",
    text: "Nodig planners uit zodat zij mee kunnen kijken en berichten kunnen opvolgen.",
    href: "/organisatie/medewerkers",
    cta: "Team beheren",
  },
];

const instructorNextActions = [
  {
    title: "Bekijk passende opdrachten",
    text: "Start met opdrachten binnen je reisafstand en filter daarna op sport, datum of vergoeding.",
    href: "/opdrachten",
    cta: "Opdrachten bekijken",
  },
  {
    title: "Reageer gericht",
    text: "Gebruik je reactie om beschikbaarheid, tarief en eventuele vragen meteen duidelijk te maken.",
    href: "/opdrachten",
    cta: "Matches openen",
  },
  {
    title: "Volg je opvolging",
    text: "Bekijk open reacties, bevestigingen en gesprekken zodat niets blijft hangen.",
    href: "/mijn-reacties",
    cta: "Mijn reacties",
  },
];

export default async function DashboardPage() {
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

    const locationIds = orgContext.locations.map((location) => location.id);

    const [jobsResult, subsResult, applicationsResult] = await Promise.all([
      supabase
        .from("jobs")
        .select("id, status", { count: "exact" })
        .eq("organization_id", orgContext.organization.id)
        .eq("status", "open"),
      locationIds.length > 0
        ? supabase.from("subscriptions").select("*").in("location_id", locationIds)
        : Promise.resolve({ data: [] as Subscription[] }),
      supabase
        .from("job_applications")
        .select("id, job:jobs!inner(organization_id)", {
          count: "exact",
          head: true,
        })
        .eq("job.organization_id", orgContext.organization.id)
        .eq("status", "pending"),
    ]);

    const subscriptions = (subsResult.data as Subscription[] | null) ?? [];
    const hasInactiveLocation = subscriptions.some(
      (subscription) => !subscriptionGrantsAccess(subscription),
    );

    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {orgContext.organization.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Overzicht van je opdrachten, reacties en volgende acties.
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
            <div>
              <p className="text-sm font-medium text-primary">
                Volgende beste stap
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">
                Maak je eerste opdracht zo concreet dat instructeurs direct kunnen reageren.
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Noem sport, datum, tijd, locatie, vergoeding en wat iemand moet
                kunnen. Daarna kun je reacties vergelijken en digitaal bevestigen.
              </p>
            </div>
            <Link href="/organisatie/opdrachten/nieuw">
              <Button className="w-full sm:w-auto">
                Nieuwe opdracht
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {organizationNextActions.map((action) => (
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
              <CardDescription>Open opdrachten</CardDescription>
              <CardTitle className="text-3xl">{jobsResult.count ?? 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                href="/organisatie/opdrachten"
              >
                Bekijken <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Nieuwe reacties</CardDescription>
              <CardTitle className="text-3xl">
                {applicationsResult.count ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                href="/organisatie/kandidaten"
              >
                Kandidaten bekijken <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Vestigingen</CardDescription>
              <CardTitle className="text-3xl">
                {orgContext.locations.length}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                href="/organisatie/vestigingen"
              >
                Beheren <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <Briefcase className="mb-1 h-6 w-6 text-primary" />
              <CardTitle>Plaats een opdracht</CardTitle>
              <CardDescription>
                Van spoed-inval tot vaste vacature: bereik direct passende
                instructeurs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/organisatie/opdrachten/nieuw">
                <Button>Nieuwe opdracht</Button>
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Users className="mb-1 h-6 w-6 text-primary" />
              <CardTitle>Beheer je team</CardTitle>
              <CardDescription>
                Nodig planners en vestigingsmanagers uit met een eigen login.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/organisatie/medewerkers">
                <Button variant="outline">Medewerkers</Button>
              </Link>
            </CardContent>
          </Card>
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

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Hoi {profile.full_name.split(" ")[0]}!
        </h1>
        <p className="text-sm text-muted-foreground">
          Dit is jouw overzicht voor opdrachten, reacties en gesprekken.
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
              Volgende beste stap
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">
              Zoek een opdracht die past bij je sport, agenda en reisafstand.
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Bekijk eerst je beste matches. Reageer alleen als tijd, locatie en
              vergoeding kloppen, of stel direct een duidelijke vraag.
            </p>
          </div>
          <Link href="/opdrachten">
            <Button className="w-full sm:w-auto">
              Opdrachten bekijken
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
              {applicationsResult.count ?? 0}
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

      <Card>
        <CardHeader>
          <Search className="mb-1 h-6 w-6 text-primary" />
          <CardTitle>Vind je volgende opdracht</CardTitle>
          <CardDescription>
            Opdrachten worden gesorteerd op afstand, specialisatie en jouw
            beoordeling.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/opdrachten">
            <Button>Opdrachten bekijken</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
