import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Dumbbell,
  LogIn,
  MessageSquare,
  MousePointerClick,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BRAND } from "@/lib/branding";

export const metadata: Metadata = {
  title: "Demo bekijken",
  description:
    "Bekijk SportMatch ZZP als sportschool of instructeur voordat je een eigen account aanmaakt.",
};

const demoSteps = [
  {
    title: "Kies je rol",
    text: "Start als sportschool als je instructeurs zoekt. Start als instructeur als je opdrachten wilt vinden.",
    icon: MousePointerClick,
  },
  {
    title: "Login staat klaar",
    text: "De demo-link vult e-mail en wachtwoord automatisch in. Klik daarna op Log in met demo-account.",
    icon: LogIn,
  },
  {
    title: "Bekijk de echte route",
    text: "Open dashboard, opdrachten, reacties en berichten zodat je voelt hoe het dagelijkse werk loopt.",
    icon: CheckCircle2,
  },
];

const demoAccounts = [
  {
    title: "Demo voor sportscholen",
    role: "Eigenaar of planner die snel bezetting zoekt",
    description:
      "Je kijkt mee vanuit FitZone Utrecht. Deze kant draait om opdrachten plaatsen, reacties beoordelen en duidelijk krijgen wie je kunt inzetten.",
    href: "/login?demo=sportschool",
    icon: Building2,
    primaryFocus:
      "Snel vervanging regelen zonder losse appjes en onduidelijke beschikbaarheid.",
    preview: {
      title: "Spinning-inval vanavond",
      meta: "Utrecht · 19:00 · € 55-€ 70 · 3 reacties",
      text: "Bekijk hoe een opdracht concreet wordt en hoe je kandidaten opvolgt voordat je contactgegevens deelt.",
    },
    highlights: ["Opdracht plaatsen", "Reacties vergelijken", "Team en vestigingen"],
    route: [
      {
        icon: ClipboardList,
        text: "Open het dashboard en zie hoeveel opdrachten, reacties en vestigingen er lopen.",
      },
      {
        icon: CalendarCheck,
        text: "Bekijk hoe je een opdracht concreet maakt met sport, datum, tijd, locatie en vergoeding.",
      },
      {
        icon: MessageSquare,
        text: "Ga naar kandidaten en berichten om te zien hoe opvolging richting instructeurs werkt.",
      },
    ],
    cta: "Bekijk demo als sportschool",
  },
  {
    title: "Demo voor instructeurs",
    role: "ZZP-instructeur die passende opdrachten zoekt",
    description:
      "Je kijkt vanuit een instructeursprofiel met historie en badges. Deze kant draait om passende opdrachten vinden, reageren en opvolging bewaren.",
    href: "/login?demo=instructeur",
    icon: Dumbbell,
    primaryFocus:
      "Snel zien welke opdrachten bij je sport, agenda, tarief en reisafstand passen.",
    preview: {
      title: "Yoga-reeks voor 6 weken",
      meta: "Den Haag · dinsdag · 94% match · € 60 per les",
      text: "Bekijk hoe filters, matchscore, vergoeding en berichten helpen om gericht te reageren.",
    },
    highlights: ["Matches zoeken", "Gericht reageren", "Reviews en badges"],
    route: [
      {
        icon: Search,
        text: "Open opdrachten en filter op sport, datum, afstand en minimale vergoeding.",
      },
      {
        icon: CalendarCheck,
        text: "Bekijk je reacties om te zien welke aanvragen nog openstaan of bevestigd zijn.",
      },
      {
        icon: MessageSquare,
        text: "Check berichten, reviews en documentbadges om te zien hoe vertrouwen wordt opgebouwd.",
      },
    ],
    cta: "Bekijk demo als instructeur",
  },
];

const trustNotes = [
  "30 dagen gratis starten voordat je betaalt.",
  "Daarna € 5 per maand excl. btw voor instructeurs.",
  "Voor sportorganisaties € 5 per vestiging per maand excl. btw.",
  "Geen commissie op de afgesproken opdrachtvergoeding.",
];

export default function DemoPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:py-16">
      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
        <div className="space-y-4">
          <Badge className="w-fit" variant="accent">
            Twee demo's, twee gebruikers
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Bekijk SportMatch ZZP vanuit de rol die bij jou past.
          </h1>
          <p className="text-lg leading-8 text-muted-foreground">
            Kies sportschool als je instructeurs wilt vinden. Kies instructeur
            als je opdrachten wilt aannemen. Je krijgt meteen gevulde
            inloggegevens, zodat je eerst kunt rondkijken voordat je een eigen
            account maakt.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/login?demo=sportschool">
              <Button className="w-full sm:w-auto">
                Bekijk demo als sportschool
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login?demo=instructeur">
              <Button className="w-full sm:w-auto" variant="outline">
                Bekijk demo als instructeur
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
                <div className="rounded-lg border border-border bg-background p-4">
                  <p className="text-sm font-medium">Voorbeeld in deze demo</p>
                  <h2 className="mt-2 font-semibold">{account.preview.title}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {account.preview.meta}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {account.preview.text}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-sm font-medium">Waar deze demo om draait</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {account.primaryFocus}
                  </p>
                </div>
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
                <div className="space-y-2 rounded-lg border border-border bg-background p-3">
                  <p className="text-sm font-medium">Bekijk vooral dit</p>
                  <ul className="space-y-2">
                    {account.route.map((item) => {
                      const RouteIcon = item.icon;

                      return (
                        <li
                          className="flex gap-2 text-sm leading-6 text-muted-foreground"
                          key={item.text}
                        >
                          <RouteIcon className="mt-1 h-4 w-4 shrink-0 text-primary" />
                          <span>{item.text}</span>
                        </li>
                      );
                    })}
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

      <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_0.85fr]">
        <div className="rounded-lg border border-border bg-muted/40 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-background p-2 text-primary">
              <LogIn className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Daarna pas echt starten</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                De twee demo-accounts gebruiken hetzelfde wachtwoord:
                SportMatch2026! Bevalt het platform, dan maak je daarna gratis
                je eigen account aan en rond je profiel of organisatie af.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Link href="/registreren?rol=organisatie">
                  <Button className="w-full sm:w-auto" variant="outline">
                    Start 30 dagen gratis als sportschool
                  </Button>
                </Link>
                <Link href="/registreren?rol=instructeur">
                  <Button className="w-full sm:w-auto" variant="outline">
                    Start 30 dagen gratis als instructeur
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
            <ShieldCheck className="h-4 w-4" /> Vertrouwen en kosten
          </div>
          <div className="space-y-2">
            {trustNotes.map((note) => (
              <p className="flex gap-2 text-sm leading-6" key={note}>
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                <span>{note}</span>
              </p>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            De opdrachtvergoeding loopt rechtstreeks tussen sportschool en
            instructeur. {BRAND.name} is een matchingplatform en geen juridisch
            of fiscaal adviseur.
          </p>
        </div>
      </div>
    </div>
  );
}
