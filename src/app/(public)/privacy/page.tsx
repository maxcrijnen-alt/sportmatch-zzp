import type { Metadata } from "next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BRAND } from "@/lib/branding";

export const metadata: Metadata = {
  title: "Privacybeleid",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Privacybeleid</h1>

      <Alert className="mt-6" variant="warning">
        <AlertTitle>Concept — juridisch te toetsen vóór lancering</AlertTitle>
        <AlertDescription>
          Dit is een placeholder-privacybeleid voor de testfase van{" "}
          {BRAND.name}. Laat dit document door een jurist controleren en
          aanvullen (o.a. AVG-grondslagen, bewaartermijnen,
          verwerkersovereenkomsten en datalekprocedure) voordat het platform
          publiek wordt gelanceerd.
        </AlertDescription>
      </Alert>

      <div className="prose-sm mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            Welke gegevens verwerken we?
          </h2>
          <p>
            Accountgegevens (naam, e-mailadres, telefoonnummer, woonplaats),
            profielgegevens (specialisaties, ervaring, tarief, beschikbaarheid),
            geüploade documenten (diploma&apos;s, certificaten, VOG,
            verzekeringsbewijs), organisatie- en vestigingsgegevens,
            opdracht- en chatgegevens, beoordelingen en technische loggegevens.
            We slaan bewust géén identiteitsbewijzen op.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            Waarvoor gebruiken we deze gegevens?
          </h2>
          <p>
            Voor het aanbieden van het platform: matching tussen organisaties en
            instructeurs, communicatie, documentcontrole, notificaties,
            abonnementsbeheer en het verbeteren van de dienst. Je exacte
            woonlocatie wordt nooit aan andere gebruikers getoond; alleen een
            globale plaatsaanduiding of afstand.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            Wie heeft toegang?
          </h2>
          <p>
            Documenten zijn alleen zichtbaar voor jou en beheerders die de
            controle uitvoeren. Contactgegevens worden pas met de andere partij
            gedeeld na definitieve bevestiging van een opdracht. Chats zijn
            alleen zichtbaar voor de deelnemers en beheerders bij misbruikmeldingen.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            Opslag en beveiliging
          </h2>
          <p>
            Gegevens worden opgeslagen bij onze hostingpartners (Supabase en
            Vercel) binnen de door hen geboden beveiligingsmaatregelen,
            waaronder versleutelde verbindingen en toegangscontrole op rijniveau.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            Jouw rechten
          </h2>
          <p>
            Je kunt inzage, correctie of verwijdering van je gegevens vragen via{" "}
            {BRAND.supportEmail}. Bij een klacht kun je terecht bij de Autoriteit
            Persoonsgegevens.
          </p>
        </section>
      </div>
    </div>
  );
}
