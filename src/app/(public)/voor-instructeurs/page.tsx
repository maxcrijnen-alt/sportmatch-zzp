import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  CalendarRange,
  Euro,
  MapPin,
  MessageSquare,
  Star,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BRAND } from "@/lib/branding";

export const metadata: Metadata = {
  title: "Voor instructeurs",
};

const benefits = [
  {
    icon: MapPin,
    title: "Opdrachten binnen jouw reisafstand",
    text: "Stel je maximale reisafstand in en zie alleen opdrachten die echt haalbaar zijn. Je exacte woonadres blijft altijd verborgen.",
  },
  {
    icon: Euro,
    title: "Jij bepaalt je tarief",
    text: "Zet je uurtarief in je profiel en doe per opdracht een tegenvoorstel als de vergoeding niet past. Bij spoedopdrachten liggen tarieven vaak hoger.",
  },
  {
    icon: CalendarRange,
    title: "Werk wanneer jij wilt",
    text: "Combineer statussen: zzp'er, werknemer, student of werkzoekend. Stel je beschikbaarheid per weekdag in en blokkeer datums die niet uitkomen.",
  },
  {
    icon: BadgeCheck,
    title: "Badges die vertrouwen geven",
    text: "Upload je diploma's, EHBO, VOG en verzekering één keer. Na controle krijg je badges die organisaties direct zien.",
  },
  {
    icon: MessageSquare,
    title: "Veilig contact",
    text: "Chat via het platform. Je telefoonnummer en e-mailadres worden pas gedeeld nadat een opdracht definitief bevestigd is.",
  },
  {
    icon: Star,
    title: "Bouw aan je reputatie",
    text: "Na elke opdracht beoordelen jullie elkaar. Goede beoordelingen en weinig annuleringen zorgen voor een hogere positie in de matching.",
  },
];

export default function VoorInstructeursPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">
        Meer opdrachten, minder gedoe
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Of je nu fulltime zzp&apos;er bent of naast je baan of studie lesgeeft:
        via {BRAND.name} vind je invalklussen, losse opdrachten, terugkerende
        lessen en vacatures bij sportorganisaties in de Randstad.
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

      <h2 className="mt-12 text-xl font-semibold">Wat kost het?</h2>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Je start met 30 dagen gratis. Daarna kost een abonnement € 5 per maand
        (excl. btw), maandelijks opzegbaar. Registreren en je profiel opbouwen
        is altijd gratis; een actief abonnement heb je nodig om te reageren, te
        chatten en opdrachten te bevestigen. {BRAND.name} rekent geen commissie
        over je verdiensten — de betaling van de opdracht regel je rechtstreeks
        met de organisatie.
      </p>

      <Alert className="mt-10" variant="info">
        <AlertTitle>Zzp&apos;er? Dit blijft jouw verantwoordelijkheid</AlertTitle>
        <AlertDescription>
          Werk je als zelfstandige, dan blijf je zelf verantwoordelijk voor je
          KvK-inschrijving, btw en belastingaangifte, een passende
          aansprakelijkheidsverzekering en de beoordeling van de arbeidsrelatie
          per opdracht. {BRAND.name} geeft geen juridisch of fiscaal advies en
          garandeert niet dat een opdracht voldoet aan de regels rond
          schijnzelfstandigheid.
        </AlertDescription>
      </Alert>

      <div className="mt-10">
        <Link href="/registreren?rol=instructeur">
          <Button size="lg">Maak je gratis profiel</Button>
        </Link>
      </div>
    </div>
  );
}
