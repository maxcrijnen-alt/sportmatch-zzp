import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  CalendarRange,
  CheckCircle2,
  Euro,
  Eye,
  MapPin,
  MessageSquare,
  Search,
  ShieldCheck,
  Star,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BRAND } from "@/lib/branding";

export const metadata: Metadata = {
  title: "Voor instructeurs",
};

const exampleJobs = [
  {
    title: "Spinning-inval vanavond",
    meta: "Utrecht · 45 minuten · spoedtarief",
    text: "Bekijk of tijd, reisafstand en vergoeding passen. Reageer direct of stel een vraag via chat.",
  },
  {
    title: "Yoga-reeks voor 6 weken",
    meta: "Den Haag · dinsdagochtend · terugkerend",
    text: "Handig als je vaste momenten zoekt zonder meteen aan een dienstverband vast te zitten.",
  },
  {
    title: "Fitnesscoach tijdelijke drukte",
    meta: "Rotterdam · 3 dagen per week · in overleg",
    text: "Gebruik je profiel, badges en reviews om te laten zien waarom jij goed past.",
  },
];

const startSteps = [
  {
    icon: BadgeCheck,
    title: "Maak je profiel compleet",
    text: "Vul sporten, ervaring, regio, tarief en beschikbaarheid in. Upload documenten voor zichtbare badges.",
  },
  {
    icon: Search,
    title: "Zoek passende opdrachten",
    text: "Filter op sport, datum, reisafstand en minimale vergoeding. Begin met opdrachten die bij jou passen.",
  },
  {
    icon: CalendarCheck,
    title: "Reageer en volg op",
    text: "Reageer gericht, chat over details en bevestig alleen wanneer de afspraken duidelijk zijn.",
  },
];

const benefits = [
  {
    icon: MapPin,
    title: "Opdrachten binnen jouw reisafstand",
    text: "Stel je maximale afstand in en voorkom dat je door onhaalbare opdrachten moet zoeken.",
  },
  {
    icon: Euro,
    title: "Geen commissie op je vergoeding",
    text: "Jij en de organisatie spreken de opdrachtvergoeding af. De betaling loopt rechtstreeks tussen jullie.",
  },
  {
    icon: CalendarRange,
    title: "Geschikt naast werk, studie of zzp",
    text: "Gebruik het platform voor losse lessen, spoed-inval, reeksen of langere tijdelijke opdrachten.",
  },
  {
    icon: ShieldCheck,
    title: "Badges voor vertrouwen",
    text: "Laat gecontroleerde diploma's, EHBO/BHV, VOG en verzekering zien wanneer dat relevant is.",
  },
  {
    icon: MessageSquare,
    title: "Chat voordat gegevens gedeeld worden",
    text: "Stem details af zonder meteen je telefoonnummer of e-mailadres te delen.",
  },
  {
    icon: Star,
    title: "Bouw aan je reputatie",
    text: "Reviews na afgeronde opdrachten helpen je betrouwbaarder en zichtbaarder te worden.",
  },
];

const profileChecklist = [
  "Sporten en specialisaties",
  "Uurtarief en voorkeuren",
  "Maximale reisafstand",
  "Beschikbaarheid per weekdag",
  "Diploma's, VOG, EHBO/BHV en verzekering",
  "Korte bio en ervaring",
];

export default function VoorInstructeursPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:py-16">
      <section className="grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <div className="space-y-5">
          <Badge className="w-fit" variant="accent">
            Voor zzp-instructeurs en sportprofessionals
          </Badge>
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
            Vind opdrachten die passen bij je sport, agenda en reisafstand.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            Via {BRAND.name} vind je spoed-inval, losse lessen, terugkerende
            reeksen, tijdelijke functies en vacatures bij sportorganisaties in
            de {BRAND.region}. Je ziet snel wat past en reageert alleen wanneer
            tijd, vergoeding en locatie kloppen.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/registreren?rol=instructeur">
              <Button className="w-full sm:w-auto" size="lg">
                Maak je gratis profiel
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login?demo=instructeur">
              <Button className="w-full sm:w-auto" size="lg" variant="outline">
                Bekijk instructeur-demo
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            30 dagen gratis. Daarna € 5 per maand excl. btw, maandelijks
            opzegbaar. Geen commissie over je opdrachtvergoeding.
          </p>
        </div>

        <div className="rounded-lg border border-primary/30 bg-primary/5 p-5">
          <p className="text-sm font-semibold text-primary">
            Wat zie je in de demo?
          </p>
          <div className="mt-4 space-y-3">
            {[
              "Opdrachten met filters op sport, datum, afstand en vergoeding.",
              "Mijn reacties met openstaande en bevestigde aanvragen.",
              "Berichten, reviews en documentbadges voor meer vertrouwen.",
            ].map((item) => (
              <p className="flex gap-3 text-sm leading-6" key={item}>
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                <span>{item}</span>
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-14">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Voorbeelden van opdrachten
            </h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Van een losse invalavond tot terugkerende lessen. Je beslist zelf
              waarop je reageert.
            </p>
          </div>
          <Link href="/demo">
            <Button className="w-full sm:w-auto" variant="outline">
              Eerst rondkijken
            </Button>
          </Link>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {exampleJobs.map((job) => (
            <Card key={job.title}>
              <CardHeader>
                <CardTitle className="text-lg">{job.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{job.meta}</p>
              </CardHeader>
              <CardContent className="text-sm leading-6 text-muted-foreground">
                {job.text}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-14 grid gap-4 md:grid-cols-3">
        {startSteps.map((step, index) => (
          <div className="rounded-lg border border-border bg-card p-5" key={step.title}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <step.icon className="h-7 w-7 text-primary" />
              <span className="text-sm text-muted-foreground">0{index + 1}</span>
            </div>
            <h2 className="font-semibold">{step.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {step.text}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-14 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Je profiel moet meteen vertrouwen geven
          </h2>
          <p className="mt-3 text-muted-foreground">
            Sportscholen kijken niet alleen naar je tarief. Ze willen weten of
            je beschikbaar bent, ervaring hebt en de juiste documenten op orde
            hebt.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {profileChecklist.map((item) => (
            <p className="flex gap-3 text-sm leading-6" key={item}>
              <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
              <span>{item}</span>
            </p>
          ))}
        </div>
      </section>

      <section className="mt-14 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Minder zoeken, betere keuzes
          </h2>
          <p className="mt-3 text-muted-foreground">
            De opdracht moet passen bij je planning, reistijd, sport en tarief.
            Daarom staat zoeken en filteren centraal.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {benefits.map((benefit) => (
            <div key={benefit.title}>
              <benefit.icon className="mb-3 h-7 w-7 text-primary" />
              <h3 className="font-semibold">{benefit.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {benefit.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      <Alert className="mt-12" variant="info">
        <AlertTitle>Zzp'er? Dit blijft jouw verantwoordelijkheid</AlertTitle>
        <AlertDescription>
          Werk je als zelfstandige, dan blijf je zelf verantwoordelijk voor je
          KvK-inschrijving, btw en belastingaangifte, een passende
          aansprakelijkheidsverzekering en de beoordeling van de arbeidsrelatie
          per opdracht. {BRAND.name} geeft geen juridisch of fiscaal advies.
        </AlertDescription>
      </Alert>

      <section className="mt-12 flex flex-col gap-4 rounded-lg border border-border bg-muted/40 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
            <Eye className="h-4 w-4" /> Eerst zien, dan starten
          </div>
          <h2 className="text-xl font-semibold">Bekijk de instructeur-demo</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            De demo vult de login automatisch in. Daarna kun je opdrachten,
            reacties, berichten, reviews en badges bekijken.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/login?demo=instructeur">
            <Button className="w-full sm:w-auto">Demo openen</Button>
          </Link>
          <Link href="/registreren?rol=instructeur">
            <Button className="w-full sm:w-auto" variant="outline">
              Gratis profiel maken
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
