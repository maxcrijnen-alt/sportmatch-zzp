import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Dumbbell,
  LockKeyhole,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { startDemoAction } from "@/lib/demo/actions";

export const metadata: Metadata = {
  title: "Demo bekijken",
  description:
    "Bekijk SportMatch als sportschool of instructeur in een eigen, afgeschermde demosessie.",
};

const demos = [
  {
    role: "organization",
    title: "Demo als sportschool",
    description:
      "Plaats opdrachten, vergelijk reacties, nodig instructeurs uit en bekijk geplande lessen in de agenda.",
    icon: Building2,
    highlights: ["Opdrachten plaatsen", "Kandidaten vergelijken", "Agenda en berichten"],
  },
  {
    role: "instructor",
    title: "Demo als instructeur",
    description:
      "Vind passende opdrachten, reageer, volg uitnodigingen en bekijk bevestigde trainingen in je agenda.",
    icon: Dumbbell,
    highlights: ["Opdrachten vinden", "Reageren en bevestigen", "Reviews en documenten"],
  },
] as const;

const errorMessages: Record<string, string> = {
  config: "De demo is tijdelijk niet geconfigureerd. Probeer het later opnieuw.",
  login: "De tijdelijke demosessie kon niet worden geopend. Probeer opnieuw.",
  role: "Kies een geldige demo.",
  start: "De demo kon nu niet worden gestart. Probeer het over een moment opnieuw.",
};

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:py-16">
      <div className="mx-auto max-w-3xl space-y-4 text-center">
        <Badge className="w-fit" variant="accent">
          Veilige interactieve demo
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
          Bekijk SportMatch vanuit de rol die bij jou past.
        </h1>
        <p className="text-lg leading-8 text-muted-foreground">
          Iedere start maakt een nieuwe, afgeschermde demosessie met dezelfde
          vaste uitgangssituatie. Wat jij wijzigt, blijft alleen in jouw sessie.
        </p>
      </div>

      {error && errorMessages[error] ? (
        <p
          className="mx-auto mt-6 max-w-2xl rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-center text-sm text-destructive"
          role="alert"
        >
          {errorMessages[error]}
        </p>
      ) : null}

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {demos.map((demo) => {
          const Icon = demo.icon;
          return (
            <Card className="h-full" key={demo.role}>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-primary/10 p-2 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle>{demo.title}</CardTitle>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {demo.description}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <ul className="space-y-2">
                  {demo.highlights.map((highlight) => (
                    <li className="flex items-center gap-2 text-sm" key={highlight}>
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      {highlight}
                    </li>
                  ))}
                </ul>
                <form action={startDemoAction}>
                  <input name="role" type="hidden" value={demo.role} />
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700" size="lg">
                    Start {demo.title.toLowerCase()}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </form>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <LockKeyhole className="h-5 w-5 text-primary" />
          <h2 className="mt-3 font-semibold">Volledig afgeschermd</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Andere bezoekers zien jouw opdrachten, reacties en berichten niet.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <RefreshCw className="h-5 w-5 text-primary" />
          <h2 className="mt-3 font-semibold">Steeds een schone start</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Uitloggen of opnieuw starten verwijdert de tijdelijke sessie.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <CalendarCheck className="h-5 w-5 text-primary" />
          <h2 className="mt-3 font-semibold">Echte productflow</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Test agenda, meldingen, reviews en berichten met server-side data.
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-lg border border-primary/30 bg-primary/5 p-5 text-center sm:flex-row sm:text-left">
        <div>
          <p className="flex items-center justify-center gap-2 font-semibold sm:justify-start">
            <ShieldCheck className="h-5 w-5 text-primary" /> Geen gedeelde
            inloggegevens
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tijdelijke accounts worden uitsluitend op de server aangemaakt en na
            afloop verwijderd.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/registreren?rol=organisatie">
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
              Start als sportschool
            </Button>
          </Link>
          <Link href="/registreren?rol=instructeur">
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
              Start als instructeur
            </Button>
          </Link>
        </div>
      </div>

      <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
        <MessageSquare className="h-4 w-4" /> De demo bevat realistische maar
        niet-openbare voorbeeldgegevens.
      </p>
    </div>
  );
}
