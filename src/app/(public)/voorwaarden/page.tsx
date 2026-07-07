import type { Metadata } from "next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BRAND } from "@/lib/branding";

export const metadata: Metadata = {
  title: "Algemene voorwaarden",
};

export default function VoorwaardenPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">
        Algemene voorwaarden
      </h1>

      <Alert className="mt-6" variant="warning">
        <AlertTitle>Concept — juridisch te toetsen vóór lancering</AlertTitle>
        <AlertDescription>
          Dit zijn placeholder-voorwaarden voor de testfase van {BRAND.name}.
          Laat deze voorwaarden — inclusief de annulerings-/vervangingsregeling
          en de conversievergoeding — door een jurist controleren voordat het
          platform publiek wordt gelanceerd.
        </AlertDescription>
      </Alert>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            1. Rol van het platform
          </h2>
          <p>
            {BRAND.name} is een matchingplatform. Wij brengen sportorganisaties
            en sportinstructeurs met elkaar in contact en faciliteren
            communicatie, documentcontrole en digitale bevestiging van
            opdrachtvoorwaarden. {BRAND.name} is geen partij bij de
            overeenkomst tussen organisatie en instructeur, geen
            uitzendbureau, geen bemiddelaar in arbeidsrechtelijke zin en geen
            juridisch of fiscaal adviseur.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            2. Eigen verantwoordelijkheid
          </h2>
          <p>
            Gebruikers blijven volledig zelf verantwoordelijk voor: de juiste
            contract- en arbeidsvorm, naleving van wet- en regelgeving
            (waaronder regels rond schijnzelfstandigheid), belastingen en btw,
            verzekeringen, geldige diploma&apos;s en certificaten, en de
            beoordeling van geschiktheid en veiligheid. Documentcontrole door
            het platform is ondersteunend en biedt geen garantie.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            3. Betaling van opdrachten
          </h2>
          <p>
            De vergoeding voor een opdracht wordt rechtstreeks tussen
            organisatie en instructeur afgesproken en betaald, buiten het
            platform om. Het platform int deze vergoeding niet en is niet
            aansprakelijk voor betalingsgeschillen.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            4. Annulerings- en vervangingsregeling
          </h2>
          <p>
            Bij annulering van een bevestigde opdracht zonder goedgekeurde
            vervanger geldt een oplopende vergoeding van 25% (annulering binnen
            12 uur voor aanvang), 50% (binnen 6 uur) of 100% (binnen 2 uur) van
            de afgesproken opdrachtvergoeding. Deze regeling geldt wederzijds.
            Het platform registreert de regeling; verrekening vindt rechtstreeks
            tussen partijen plaats. In uitzonderlijke gevallen kan de beheerder
            een registratie corrigeren.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            5. Conversievergoeding
          </h2>
          <p>
            Neemt een organisatie een instructeur die zij aantoonbaar via het
            platform heeft leren kennen binnen 6 maanden na het eerste contact
            vast in dienst, dan is de organisatie een eenmalige
            bemiddelingsvergoeding van € 50 (excl. btw) aan het platform
            verschuldigd. De organisatie meldt de aanname via het platform.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            6. Abonnement
          </h2>
          <p>
            Abonnementen kosten € 5 per maand (excl. btw) per instructeur of
            per vestiging, na een gratis proefperiode van 30 dagen, en zijn
            maandelijks opzegbaar. Bij een mislukte betaling geldt een
            hersteltermijn van 14 dagen. Zonder actieve toegang blijven
            bestaande afspraken zichtbaar, maar zijn reageren, chatten,
            plaatsen en bevestigen geblokkeerd.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            7. Gedrag en misbruik
          </h2>
          <p>
            Misleidende profielen, valse documenten, discriminatie of misbruik
            van het platform kunnen leiden tot verwijdering van content,
            schorsing of beëindiging van het account.
          </p>
        </section>
      </div>
    </div>
  );
}
