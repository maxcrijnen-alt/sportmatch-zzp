import type { Metadata } from "next";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/branding";

export const metadata: Metadata = {
  title: "Hoe het werkt",
};

const instructorSteps = [
  "Registreer je gratis en vul je profiel in: specialisaties, uurtarief, reisafstand en beschikbaarheid.",
  "Upload je diploma's, EHBO/BHV, VOG en verzekering. Na handmatige controle krijg je zichtbare badges.",
  "Bekijk opdrachten die bij je passen, gesorteerd op afstand, specialisatie en jouw beoordeling.",
  "Reageer met “Ik ben beschikbaar” of doe een tegenvoorstel op de vergoeding.",
  "Chat met de organisatie en ga digitaal akkoord met de opdrachtvoorwaarden.",
  "Na afloop beoordelen jullie elkaar. Zo groeit je betrouwbaarheidsscore.",
];

const organizationSteps = [
  "Registreer je organisatie en voeg vestigingen en teamleden toe.",
  "Plaats een opdracht: spoed-inval, eenmalig, terugkerend, tijdelijk of een vaste vacature.",
  "Ontvang reacties van passende instructeurs en vergelijk kandidaten op afstand, ervaring en beoordeling.",
  "Nodig zelf instructeurs uit of accepteer een tegenvoorstel.",
  "Ga digitaal akkoord; daarna bevestigt de instructeur en is de opdracht definitief.",
  "Na afloop beoordelen jullie elkaar en bouw je aan een vast netwerk van invallers.",
];

export default function HoeHetWerktPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Hoe het werkt</h1>
      <p className="mt-3 text-muted-foreground">
        {BRAND.name} brengt vraag en aanbod in de sportwereld samen. Het
        platform faciliteert matching, communicatie, documentcontrole en
        transparante opdrachtvoorwaarden — de opdracht zelf en de betaling
        daarvan regelen jullie rechtstreeks met elkaar.
      </p>

      <h2 className="mt-10 text-xl font-semibold">Voor instructeurs</h2>
      <ol className="mt-4 space-y-3">
        {instructorSteps.map((step, index) => (
          <li className="flex gap-3" key={step}>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {index + 1}
            </span>
            <span className="pt-0.5 text-sm">{step}</span>
          </li>
        ))}
      </ol>

      <h2 className="mt-10 text-xl font-semibold">Voor sportorganisaties</h2>
      <ol className="mt-4 space-y-3">
        {organizationSteps.map((step, index) => (
          <li className="flex gap-3" key={step}>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
              {index + 1}
            </span>
            <span className="pt-0.5 text-sm">{step}</span>
          </li>
        ))}
      </ol>

      <h2 className="mt-10 text-xl font-semibold">Spoed, annulering en vervanging</h2>
      <div className="mt-4 space-y-4 text-sm text-muted-foreground">
        <p>
          <strong className="text-foreground">Spoedopdrachten.</strong> De
          organisatie bepaalt zelf of iets spoed is en mag daarvoor een hogere
          vergoeding bieden. Spoedopdrachten vallen extra op in de lijst.
        </p>
        <p>
          <strong className="text-foreground">Vervanging.</strong> Kan een
          instructeur onverwacht niet komen, dan mag hij of zij zelf een
          vervanger voorstellen. De organisatie beoordeelt en keurt de vervanger
          altijd eerst goed.
        </p>
        <p>
          <strong className="text-foreground">Annuleringsregeling.</strong>{" "}
          Wordt er kort van tevoren geannuleerd zonder goedgekeurde vervanger,
          dan geldt een oplopende annuleringsvergoeding (25% – 100% van de
          afgesproken vergoeding, afhankelijk van het moment van afzeggen). Het
          platform registreert dit; de verrekening verloopt rechtstreeks tussen
          partijen. Dit werkt twee kanten op: ook als de organisatie te laat
          annuleert, geldt een vergelijkbare regeling richting de instructeur.
        </p>
      </div>

      <Alert className="mt-10" variant="info">
        <AlertTitle>Belangrijk</AlertTitle>
        <AlertDescription>
          {BRAND.name} geeft geen juridisch of fiscaal advies en garandeert
          niet dat een samenwerking voldoet aan de regels rond zelfstandig
          ondernemerschap. Organisaties en instructeurs blijven zelf
          verantwoordelijk voor de juiste contractvorm, belastingen,
          verzekeringen, diploma-eisen en naleving van wet- en regelgeving.
        </AlertDescription>
      </Alert>

      <div className="mt-10 flex gap-3">
        <Link href="/registreren">
          <Button size="lg">Gratis account maken</Button>
        </Link>
        <Link href="/faq">
          <Button size="lg" variant="outline">
            Veelgestelde vragen
          </Button>
        </Link>
      </div>
    </div>
  );
}
