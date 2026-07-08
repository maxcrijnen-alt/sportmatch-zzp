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
    title: "Plaats of bekijk je eerste opdracht",
    text: "Maak sport, datum, tijd, vergoeding, locatie en vereiste kwalificaties concreet. In de demo zie je hoe dat eruitziet.",
    href: "/organisatie/opdrachten/nieuw",
    cta: "Eerste opdracht",
  },
  {
    title: "Vergelijk kandidaten zonder zoeken",
    text: "Open reacties en vergelijk beschikbaarheid, tarief, afstand, documenten en bericht op dezelfde plek.",
    href: "/organisatie/kandidaten",
    cta: "Kandidaten bekijken",
  },
  {
    title: "Zet vestiging en team klaar",
    text: "Controleer je vestigingen en nodig planners uit zodat vervolgvragen en berichten snel worden opgepakt.",
    href: "/organisatie/vestigingen",
    cta: "Vestigingen beheren",
  },
];

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
    const openJobCount = jobsResult.count ?? 0;
    const pendingApplicationCount = applicationsResult.count ?? 0;

    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {orgContext.organization.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Je startpunt voor opdrachten, kandidaten en opvolging. Begin bij je
            eerste opdracht of pak nieuwe reacties direct op.
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
                Start hier als sportschool
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">
                {openJobCount > 0
                  ? pendingApplicationCount > 0
                    ? "Vergelijk nieuwe reacties en kies wie je wilt spreken."
                    : "Houd je open opdrachten scherp en deel ze met passende instructeurs."
                  : "Plaats je eerste opdracht in een paar minuten."}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                De snelste route naar waarde: leg een concrete opdracht vast,
                vergelijk reacties op beschikbaarheid en tarief, en rond de
                afspraak af via berichten en bevestiging.
              </p>
            </div>
            <Link
              href={
                pendingApplicationCount > 0
                  ? "/organisatie/kandidaten"
                  : openJobCount > 0
                    ? "/organisatie/opdrachten"
                    : "/organisatie/opdrachten/nieuw"
              }
            >
              <Button className="w-full sm:w-auto">
                {pendingApplicationCount > 0
                  ? "Kandidaten bekijken"
                  : openJobCount > 0
                    ? "Opdrachten bekijken"
                    : "Nieuwe opdracht"}
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
              <CardTitle className="text-3xl">{openJobCount}</CardTitle>
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
                {pendingApplicationCount}
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

      <Card>
        <CardHeader>
          <Search className="mb-1 h-6 w-6 text-primary" />
          <CardTitle>Vind je volgende opdracht</CardTitle>
          <CardDescription>
            Opdrachten worden gesorteerd op afstand, specialisatie en match met
            jouw profiel. Open een kaart om vergoeding, locatie en reactieopties
            te bekijken.
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
