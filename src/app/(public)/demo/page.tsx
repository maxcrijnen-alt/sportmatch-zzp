import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Dumbbell,
  LogIn,
  MousePointerClick,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Demo bekijken",
  description:
    "Bekijk SportMatch ZZP met demo-accounts voordat je een eigen account aanmaakt.",
};

const demoSteps = [
  {
    title: "Kies je rol",
    text: "Start als sportschool, instructeur, planner of admin. Zo zie je direct de kant die voor jou relevant is.",
    icon: MousePointerClick,
  },
  {
    title: "Login staat klaar",
    text: "De demo-link vult e-mail en wachtwoord automatisch in. Je hoeft zelf niets aan te maken.",
    icon: LogIn,
  },
  {
    title: "Bekijk de eerste acties",
    text: "Open dashboard, opdrachten, reacties en berichten om te voelen hoe het dagelijkse werk loopt.",
    icon: CheckCircle2,
  },
];

const demoAccounts = [
  {
    title: "Bekijk als sportschool",
    role: "Eigenaar FitZone Utrecht",
    description:
      "Voor sportscholen die snel willen zien hoe je opdrachten plaatst en reacties vergelijkt.",
    href: "/login?demo=sportschool",
    icon: Building2,
    highlights: ["Opdrachten beheren", "Kandidaten vergelijken", "Vestigingen bekijken"],
    route: [
      "Check het dashboard met open opdrachten en nieuwe reacties.",
      "Open de opdrachtlijst en bekijk hoe kandidaten binnenkomen.",
      "Bekijk vestigingen en teamrollen voor planners.",
    ],
    cta: "Bekijk sportschool-demo",
  },
  {
    title: "Bekijk als instructeur",
    role: "Instructeur met historie en badges",
    description:
      "Voor instructeurs die willen zien hoe passende opdrachten, reacties en reviews werken.",
    href: "/login?demo=instructeur",
    icon: Dumbbell,
    highlights: ["Passende opdrachten", "Documentbadges", "Reviews en berichten"],
    route: [
      "Bekijk passende opdrachten en filters op sport, afstand en vergoeding.",
      "Open je reacties om te zien hoe opvolging werkt.",
      "Check berichten, reviews en documentbadges.",
    ],
    cta: "Bekijk instructeur-demo",
  },
  {
    title: "Bekijk als planner",
    role: "Planner bij FitZone Utrecht",
    description:
      "Voor medewerkers die opdrachten en kandidaten volgen zonder eigenaar te zijn.",
    href: "/login?demo=planner",
    icon: Users,
    highlights: ["Teamrol testen", "Opdrachten volgen", "Berichten bekijken"],
    route: [
      "Bekijk hoe een planner opdrachten kan volgen.",
      "Controleer kandidaten en berichten vanuit een teamrol.",
      "Zie wat wel en niet bij de plannerrol hoort.",
    ],
    cta: "Bekijk planner-demo",
  },
  {
    title: "Bekijk als admin",
    role: "Beheerder",
    description:
      "Voor platformbeheer: gebruikers, documenten, organisaties, opdrachten en reviews controleren.",
    href: "/login?demo=admin",
    icon: ShieldCheck,
    highlights: ["Documentcontrole", "Gebruikersbeheer", "Platformoverzicht"],
    route: [
      "Bekijk gebruikers en organisaties vanuit beheer.",
      "Controleer documenten en badges.",
      "Zie hoe platformbrede signalen worden opgevolgd.",
    ],
    cta: "Bekijk admin-demo",
  },
];

export default function DemoPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:py-16">
      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
        <div className="space-y-4">
          <Badge className="w-fit" variant="accent">
            Geen eigen account nodig
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Kijk eerst rond voordat je een account aanmaakt.
          </h1>
          <p className="text-lg leading-8 text-muted-foreground">
            Kies een demo-rol en zie direct hoe SportMatch ZZP werkt voor
            opdrachten, reacties, berichten, documenten en beheer. De login wordt
            automatisch ingevuld met een bestaand demo-account.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/login?demo=sportschool">
              <Button className="w-full sm:w-auto">
                Demo als sportschool
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login?demo=instructeur">
              <Button className="w-full sm:w-auto" variant="outline">
                Demo als instructeur
              </Button>
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-primary/30 bg-primary/5 p-5">
          <p className="text-sm font-semibold text-primary">Zo werkt de demo</p>
          <div className="mt-4 grid gap-3">
            {demoSteps.map((step) => {
              const Icon = step.icon;

              return (
                <div className="flex gap-3" key={step.title}>
                  <div className="mt-0.5 rounded-md bg-background p-2 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">{step.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {step.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {demoAccounts.map((account) => {
          const Icon = account.icon;

          return (
            <Card className="h-full" key={account.href}>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-primary/10 p-2 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{account.title}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {account.role}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="text-sm leading-6 text-muted-foreground">
                  {account.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {account.highlights.map((highlight) => (
                    <span
                      className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                      key={highlight}
                    >
                      {highlight}
                    </span>
                  ))}
                </div>
                <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-sm font-medium">Wat je het beste bekijkt</p>
                  <ul className="space-y-2">
                    {account.route.map((item) => (
                      <li
                        className="flex gap-2 text-sm leading-6 text-muted-foreground"
                        key={item}
                      >
                        <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Link href={account.href}>
                  <Button className="w-full sm:w-auto">
                    {account.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 flex flex-col gap-4 rounded-lg border border-border bg-muted/40 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">Daarna pas echt starten</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Alle demo-accounts gebruiken hetzelfde wachtwoord: SportMatch2026!.
            Bevalt het platform, dan maak je daarna gratis je eigen account aan.
          </p>
        </div>
        <Link href="/registreren">
          <Button className="w-full sm:w-auto" variant="outline">
            Eigen account starten
          </Button>
        </Link>
      </div>
    </div>
  );
}
