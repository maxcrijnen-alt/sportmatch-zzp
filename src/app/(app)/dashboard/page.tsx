import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Briefcase,
  CalendarCheck,
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
            Overzicht van je opdrachten en kandidaten.
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
          Dit is jouw overzicht. Veel succes met je volgende opdracht.
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
