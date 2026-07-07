import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  Filter,
  ShieldCheck,
  Timer,
  UserCheck,
  Users,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BRAND } from "@/lib/branding";

export const metadata: Metadata = {
  title: "Voor sportscholen en organisaties",
};

const benefits = [
  {
    icon: Timer,
    title: "Spoed-inval geregeld",
    text: "Lesuitval kost leden. Plaats een spoedopdracht en bereik direct instructeurs die vandaag nog kunnen invallen.",
  },
  {
    icon: Filter,
    title: "Slimme matching",
    text: "Kandidaten worden gerangschikt op afstand, specialisatie, beoordeling, ervaring en betrouwbaarheid. Jij kiest wie het beste past.",
  },
  {
    icon: ShieldCheck,
    title: "Gecontroleerde documenten",
    text: "Zie in één oogopslag welke instructeurs een gecontroleerd diploma, EHBO, VOG en verzekering hebben.",
  },
  {
    icon: Building2,
    title: "Meerdere vestigingen",
    text: "Beheer al je locaties in één account. Elke medewerker krijgt een eigen login met een passende rol: eigenaar, planner of vestigingsmanager.",
  },
  {
    icon: UserCheck,
    title: "Digitale bevestiging",
    text: "Een opdracht is pas definitief als beide partijen akkoord zijn met een duidelijke samenvatting van de voorwaarden. Geen misverstanden.",
  },
  {
    icon: Users,
    title: "Van inval naar vast",
    text: "Ook vaste vacatures plaats je op het platform. Neem je een instructeur binnen 6 maanden vast aan, dan geldt een eenmalige conversievergoeding van € 50.",
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
    <div className="mx-auto w-full max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">
        Nooit meer lesuitval door personeelstekort
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Vind snel gekwalificeerde instructeurs voor inval, losse opdrachten,
        terugkerende lessen, tijdelijke functies en vaste vacatures — in de
        hele Randstad.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {benefits.map((benefit) => (
          <Card key={benefit.title}>
            <CardHeader>
              <benefit.icon className="mb-2 h-7 w-7 text-primary" />
              <CardTitle className="text-base">{benefit.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {benefit.text}
            </CardContent>
          </Card>
        ))}
      </div>

      <h2 className="mt-12 text-xl font-semibold">Voor wie?</h2>
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

      <h2 className="mt-12 text-xl font-semibold">Wat kost het?</h2>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        € 5 per vestiging per maand (excl. btw), na 30 dagen gratis proberen.
        Maandelijks opzegbaar. De vergoeding voor de instructeur spreek je
        rechtstreeks af en betaal je buiten het platform om — {BRAND.name}{" "}
        rekent daar geen commissie over.
      </p>

      <Alert className="mt-10" variant="info">
        <AlertTitle>Jullie blijven zelf verantwoordelijk</AlertTitle>
        <AlertDescription>
          {BRAND.name} controleert documenten ter ondersteuning, maar dit is
          geen absolute garantie. Als organisatie blijf je zelf verantwoordelijk
          voor de controle van geschiktheid en veiligheid, de juiste
          contractvorm en arbeidsrelatie, en naleving van wet- en regelgeving.
        </AlertDescription>
      </Alert>

      <div className="mt-10">
        <Link href="/registreren?rol=organisatie">
          <Button size="lg">Registreer je organisatie</Button>
        </Link>
      </div>
    </div>
  );
}
