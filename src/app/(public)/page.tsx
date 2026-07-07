import Link from "next/link";
import {
  BadgeCheck,
  CalendarClock,
  Dumbbell,
  MessageSquare,
  ShieldCheck,
  Star,
  Timer,
  Users,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BRAND } from "@/lib/branding";

const steps = [
  {
    icon: Users,
    title: "Maak een profiel",
    text: "Instructeurs tonen diploma's, specialisaties en beschikbaarheid. Organisaties voegen vestigingen en teamleden toe.",
  },
  {
    icon: CalendarClock,
    title: "Plaats of vind een opdracht",
    text: "Van spoed-inval tot vaste vacature. Slimme matching op afstand, specialisatie en beoordeling.",
  },
  {
    icon: MessageSquare,
    title: "Stem af en bevestig",
    text: "Chat veilig, doe eventueel een tegenvoorstel en bevestig de opdracht digitaal — pas dan worden contactgegevens gedeeld.",
  },
  {
    icon: Star,
    title: "Beoordeel elkaar",
    text: "Na afloop beoordelen beide partijen elkaar. Zo bouwt iedereen aan een betrouwbaar profiel.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-secondary text-secondary-foreground">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:py-24">
          <Badge variant="accent">Nu in de Randstad</Badge>
          <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Vind vandaag nog een sportinstructeur.
            <span className="text-accent"> Of je volgende opdracht.</span>
          </h1>
          <p className="max-w-xl text-lg text-secondary-foreground/80">
            {BRAND.name} koppelt sportorganisaties aan instructeurs voor
            spoed-inval, losse opdrachten, terugkerende lessen en vacatures.
            Transparant, snel en met gecontroleerde documenten.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/registreren?rol=instructeur">
              <Button className="bg-primary" size="lg">
                Ik ben instructeur
              </Button>
            </Link>
            <Link href="/registreren?rol=organisatie">
              <Button
                className="border-secondary-foreground/30 bg-transparent text-secondary-foreground hover:bg-secondary-foreground/10"
                size="lg"
                variant="outline"
              >
                Ik zoek instructeurs
              </Button>
            </Link>
          </div>
          <p className="text-sm text-secondary-foreground/60">
            30 dagen gratis proberen · maandelijks opzegbaar · € 5 per maand
            (excl. btw)
          </p>
        </div>
      </section>

      {/* Hoe het werkt */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Zo werkt het
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <Card key={step.title}>
              <CardHeader>
                <step.icon className="mb-2 h-8 w-8 text-primary" />
                <CardTitle>{step.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {step.text}
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-6">
          <Link className="text-sm font-medium text-primary hover:underline" href="/hoe-het-werkt">
            Lees meer over hoe het werkt →
          </Link>
        </div>
      </section>

      {/* Voordelen */}
      <section className="bg-muted/50">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <Dumbbell className="mb-2 h-8 w-8 text-primary" />
              <CardTitle className="text-xl">Voor instructeurs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>✓ Vind opdrachten die passen bij jouw specialisatie en reisafstand</p>
              <p>✓ Reageer met één klik of doe een tegenvoorstel</p>
              <p>✓ Laat je diploma&apos;s, VOG en verzekering controleren voor badges</p>
              <p>✓ Bouw een betrouwbaar profiel op met beoordelingen</p>
              <div className="pt-2">
                <Link href="/voor-instructeurs">
                  <Button variant="outline">Meer voor instructeurs</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Timer className="mb-2 h-8 w-8 text-primary" />
              <CardTitle className="text-xl">Voor sportorganisaties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>✓ Plaats een spoedopdracht en bereik direct beschikbare invallers</p>
              <p>✓ Vergelijk kandidaten op afstand, ervaring en beoordeling</p>
              <p>✓ Beheer meerdere vestigingen en teamleden in één account</p>
              <p>✓ Bevestig opdrachten digitaal met duidelijke voorwaarden</p>
              <div className="pt-2">
                <Link href="/voor-sportscholen">
                  <Button variant="outline">Meer voor organisaties</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Vertrouwen */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <div className="grid gap-8 lg:grid-cols-3">
          <div>
            <ShieldCheck className="mb-3 h-8 w-8 text-primary" />
            <h3 className="mb-2 font-semibold">Gecontroleerde documenten</h3>
            <p className="text-sm text-muted-foreground">
              Diploma&apos;s, EHBO, VOG en verzekeringen worden handmatig
              gecontroleerd. Goedgekeurde documenten leveren zichtbare badges op.
            </p>
          </div>
          <div>
            <BadgeCheck className="mb-3 h-8 w-8 text-primary" />
            <h3 className="mb-2 font-semibold">Transparante afspraken</h3>
            <p className="text-sm text-muted-foreground">
              Opdrachten worden pas definitief als beide partijen digitaal
              akkoord gaan met een duidelijke samenvatting van de voorwaarden.
            </p>
          </div>
          <div>
            <Star className="mb-3 h-8 w-8 text-primary" />
            <h3 className="mb-2 font-semibold">Eerlijke beoordelingen</h3>
            <p className="text-sm text-muted-foreground">
              Beoordelingen worden pas zichtbaar nadat beide partijen hebben
              beoordeeld. Zo blijven reviews eerlijk en onafhankelijk.
            </p>
          </div>
        </div>

        <Alert className="mt-12" variant="info">
          <AlertTitle>Goed om te weten</AlertTitle>
          <AlertDescription>
            {BRAND.name} is een matchingplatform en geen juridisch of fiscaal
            adviseur. De betaling voor de opdracht zelf verloopt rechtstreeks
            tussen organisatie en instructeur. Documentcontrole is ondersteunend
            en geen absolute garantie. Gebruikers blijven zelf verantwoordelijk
            voor de juiste arbeidsrelatie, contracten, belastingen, verzekeringen
            en naleving van wet- en regelgeving.
          </AlertDescription>
        </Alert>
      </section>

      {/* CTA */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-4 py-16 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Klaar om te beginnen?
          </h2>
          <p className="max-w-xl text-primary-foreground/85">
            Probeer {BRAND.name} 30 dagen gratis. Geen betaalgegevens nodig om
            te starten, maandelijks opzegbaar.
          </p>
          <Link href="/registreren">
            <Button
              className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
              size="lg"
            >
              Maak een gratis account
            </Button>
          </Link>
        </div>
      </section>
    </>
  );
}
