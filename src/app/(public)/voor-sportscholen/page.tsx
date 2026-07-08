import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Eye,
  Filter,
  MessageSquare,
  ShieldCheck,
  Timer,
  UserCheck,
  Users,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BRAND } from "@/lib/branding";

export const metadata: Metadata = {
  title: "Voor sportscholen en organisaties",
};

const exampleJobs = [
  {
    title: "Spinning-instructeur voor vanavond",
    meta: "Spoed · 19:00 · Utrecht",
    text: "Plaats de les, het niveau, de vergoeding en de locatie. Instructeurs reageren met beschikbaarheid en eventuele vragen.",
  },
  {
    title: "Yoga-vervanging voor 6 weken",
    meta: "Terugkerend · dinsdagochtend · Den Haag",
    text: "Leg direct vast welke reeks het is, wat het tarief is en welke ervaring belangrijk is.",
  },
  {
    title: "Fitnesscoach voor tijdelijke drukte",
    meta: "Tijdelijk · 3 dagen per week · Rotterdam",
    text: "Gebruik het platform ook voor langere opdrachten, tijdelijke functies en vaste vacatures.",
  },
];

const startSteps = [
  {
    icon: Building2,
    title: "Maak je organisatie aan",
    text: "Voeg je sportschool, vestigingen en teamleden toe. Zo kunnen eigenaren en planners vanuit dezelfde omgeving werken.",
  },
  {
    icon: ClipboardList,
    title: "Plaats een duidelijke opdracht",
    text: "Kies sport, datum, tijd, locatie, vergoeding en wat iemand moet kunnen. Hoe concreter, hoe beter de reacties.",
  },
  {
    icon: CalendarCheck,
    title: "Vergelijk en bevestig",
    text: "Bekijk reacties op afstand, ervaring, documenten en beoordeling. Bevestig pas als beide partijen akkoord zijn.",
  },
];

const benefits = [
  {
    icon: Timer,
    title: "Spoed-inval sneller geregeld",
    text: "Zet een open plek direct online en geef instructeurs genoeg informatie om meteen te reageren.",
  },
  {
    icon: Filter,
    title: "Gerichter kandidaten vergelijken",
    text: "Bekijk beschikbaarheid, reisafstand, specialisatie, ervaring, badges en beoordeling op één plek.",
  },
  {
    icon: ShieldCheck,
    title: "Meer grip op vertrouwen",
    text: "Documentbadges, reviews en digitale bevestiging helpen om minder op losse appjes te leunen.",
  },
  {
    icon: Users,
    title: "Handig voor meerdere vestigingen",
    text: "Werk met vestigingen en teamleden zonder dat alles via één inbox of appgroep hoeft te lopen.",
  },
  {
    icon: MessageSquare,
    title: "Communicatie blijft bij de opdracht",
    text: "Chat over beschikbaarheid, tarief en praktische details voordat contactgegevens worden gedeeld.",
  },
  {
    icon: UserCheck,
    title: "Van inval naar vaste poule",
    text: "Bouw na opdrachten reviews en vaste relaties op met instructeurs die goed bij je club passen.",
  },
];

const audiences = [
  "Sportscholen en fitnesscentra",
  "Boutique gyms",
  "Yogastudio's",
  "Sportverenigingen",
  "Zwembaden",
  "Gemeenten en buurtsport",
  "Hotels",
  "Vakantieparken",
  "Evenementenorganisaties",
];

export default function VoorSportscholenPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:py-16">
      <section className="grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <div className="space-y-5">
          <Badge className="w-fit" variant="accent">
            Voor sportscholen en sportorganisaties
          </Badge>
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
            Vul je rooster sneller met beschikbare instructeurs.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            Gebruik {BRAND.name} voor spoed-inval, losse lessen, terugkerende
            reeksen, tijdelijke functies en vaste vacatures. Je plaatst een
            duidelijke opdracht, vergelijkt reacties en bevestigt pas wanneer de
            afspraken kloppen.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/registreren?rol=organisatie">
              <Button className="w-full sm:w-auto" size="lg">
                Start als sportschool
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login?demo=sportschool">
              <Button className="w-full sm:w-auto" size="lg" variant="outline">
                Bekijk sportschool-demo
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            30 dagen gratis. Daarna € 5 per vestiging per maand excl. btw,
            maandelijks opzegbaar.
          </p>
        </div>

        <div className="rounded-lg border border-primary/30 bg-primary/5 p-5">
          <p className="text-sm font-semibold text-primary">
            Wat zie je in de demo?
          </p>
          <div className="mt-4 space-y-3">
            {[
              "Dashboard met open opdrachten, reacties en vestigingen.",
              "Opdrachtflow met sport, datum, tijd, locatie en vergoeding.",
              "Kandidaten, berichten en opvolging vanuit één omgeving.",
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
              Voorbeelden waarvoor je het gebruikt
            </h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Niet alleen voor nood. Ook voor terugkerende lessen en tijdelijke
              bezetting wordt de vraag meteen concreet.
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
            Minder losse berichten, meer overzicht
          </h2>
          <p className="mt-3 text-muted-foreground">
            De winst zit vooral in duidelijkheid: wie is beschikbaar, wat is
            afgesproken en welke kandidaten passen bij je les of vestiging?
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

      <section className="mt-14">
        <h2 className="text-xl font-semibold">Geschikt voor</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {audiences.map((audience) => (
            <span
              className="rounded-full border border-border bg-muted px-3 py-1 text-sm"
              key={audience}
            >
              {audience}
            </span>
          ))}
        </div>
      </section>

      <Alert className="mt-12" variant="info">
        <AlertTitle>Jullie blijven zelf verantwoordelijk</AlertTitle>
        <AlertDescription>
          {BRAND.name} controleert documenten ter ondersteuning, maar dit is
          geen absolute garantie. Als organisatie blijf je zelf verantwoordelijk
          voor geschiktheid, veiligheid, contractvorm, arbeidsrelatie en naleving
          van wet- en regelgeving.
        </AlertDescription>
      </Alert>

      <section className="mt-12 flex flex-col gap-4 rounded-lg border border-border bg-muted/40 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
            <Eye className="h-4 w-4" /> Eerst zien, dan starten
          </div>
          <h2 className="text-xl font-semibold">Bekijk de sportschool-demo</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            De demo vult de login automatisch in. Daarna kun je dashboard,
            opdrachten, kandidaten en berichten bekijken.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/login?demo=sportschool">
            <Button className="w-full sm:w-auto">Demo openen</Button>
          </Link>
          <Link href="/registreren?rol=organisatie">
            <Button className="w-full sm:w-auto" variant="outline">
              Gratis starten
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
