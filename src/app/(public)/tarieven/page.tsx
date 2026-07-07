import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BRAND } from "@/lib/branding";

export const metadata: Metadata = {
  title: "Tarieven",
};

const included = [
  "Onbeperkt opdrachten bekijken en plaatsen",
  "Slimme matching op afstand, specialisatie en beoordeling",
  "Chat met systeemmeldingen",
  "Digitale opdrachtbevestiging",
  "Documentcontrole en badges",
  "Beoordelingen en betrouwbaarheidsscore",
  "E-mail- en in-app notificaties",
];

export default function TarievenPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Tarieven</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Eén simpel abonnement. Geen commissie over je verdiensten of over de
        vergoeding die je afspreekt — die betaling verloopt rechtstreeks tussen
        organisatie en instructeur.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <Card className="border-primary">
          <CardHeader>
            <Badge className="w-fit" variant="accent">30 dagen gratis proberen</Badge>
            <CardTitle className="mt-2 text-2xl">Instructeurs</CardTitle>
            <CardDescription>
              <span className="text-3xl font-bold text-foreground">€ 5</span>{" "}
              per maand, excl. btw
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {included.map((feature) => (
              <p className="flex items-start gap-2" key={feature}>
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {feature}
              </p>
            ))}
          </CardContent>
        </Card>

        <Card className="border-primary">
          <CardHeader>
            <Badge className="w-fit" variant="accent">30 dagen gratis proberen</Badge>
            <CardTitle className="mt-2 text-2xl">Sportorganisaties</CardTitle>
            <CardDescription>
              <span className="text-3xl font-bold text-foreground">€ 5</span>{" "}
              per vestiging per maand, excl. btw
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {included.map((feature) => (
              <p className="flex items-start gap-2" key={feature}>
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {feature}
              </p>
            ))}
            <p className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Meerdere vestigingen en teamleden met eigen rollen
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-10 space-y-4 text-sm text-muted-foreground">
        <p>
          <strong className="text-foreground">Maandelijks opzegbaar.</strong>{" "}
          Geen jaarcontracten. Zeg je op, dan blijven bestaande afspraken
          zichtbaar; nieuwe opdrachten plaatsen, reageren en bevestigen kan dan
          niet meer.
        </p>
        <p>
          <strong className="text-foreground">Mislukte betaling?</strong> Je
          krijgt 14 dagen hersteltermijn voordat de toegang wordt beperkt.
        </p>
        <p>
          <strong className="text-foreground">Conversievergoeding.</strong>{" "}
          Neemt een organisatie een instructeur die zij via {BRAND.name} heeft
          leren kennen binnen 6 maanden vast in dienst, dan geldt een eenmalige
          bemiddelingsvergoeding van € 50 (excl. btw) voor de organisatie.
        </p>
      </div>

      <Alert className="mt-10">
        <AlertTitle>MVP-fase</AlertTitle>
        <AlertDescription>
          Tijdens de testfase van het platform worden betalingen nog niet
          automatisch geïncasseerd. Abonnementstatussen worden gesimuleerd en
          handmatig beheerd.
        </AlertDescription>
      </Alert>

      <div className="mt-10">
        <Link href="/registreren">
          <Button size="lg">Start je gratis proefperiode</Button>
        </Link>
      </div>
    </div>
  );
}
