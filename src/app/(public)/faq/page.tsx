import type { Metadata } from "next";
import { BRAND } from "@/lib/branding";

export const metadata: Metadata = {
  title: "Veelgestelde vragen",
};

const faqs = [
  {
    q: "Wat is SportMatch ZZP precies?",
    a: `${BRAND.name} is een matchingplatform dat sportorganisaties en sportinstructeurs bij elkaar brengt voor spoed-inval, eenmalige opdrachten, terugkerende lessen, tijdelijke functies en vaste vacatures. Het platform faciliteert het vinden, afstemmen en digitaal bevestigen van opdrachten.`,
  },
  {
    q: "Loopt de betaling van een opdracht via het platform?",
    a: "Nee. De vergoeding voor de opdracht spreek je samen af en wordt rechtstreeks tussen organisatie en instructeur betaald, buiten het platform om. Het platform rekent geen commissie over de opdrachtvergoeding.",
  },
  {
    q: "Moet ik zzp'er zijn om te reageren?",
    a: "Nee. Je kunt ook reageren als student, werkzoekende of naast een dienstverband. KvK- en btw-gegevens zijn alleen verplicht wanneer je als zelfstandige op zzp-opdrachten wilt reageren.",
  },
  {
    q: "Garandeert het platform dat ik 'veilig' als zzp'er werk?",
    a: `Nee. ${BRAND.name} geeft geen juridisch of fiscaal advies en kan niet garanderen dat een samenwerking voldoet aan de regels rond arbeidsrelaties en schijnzelfstandigheid. Beide partijen blijven zelf verantwoordelijk voor de juiste contractvorm, belastingen en verzekeringen.`,
  },
  {
    q: "Hoe werkt de documentcontrole?",
    a: "Je uploadt je diploma's, EHBO/BHV, VOG en verzekeringsbewijs. Een beheerder controleert deze handmatig, waarna je een badge krijgt. Bij bijna verlopen certificaten krijg je een waarschuwing. De controle is ondersteunend en geen absolute garantie.",
  },
  {
    q: "Wanneer worden contactgegevens gedeeld?",
    a: "Telefoonnummers en e-mailadressen blijven verborgen tot een opdracht door beide partijen digitaal is bevestigd. Tot die tijd chat je veilig via het platform.",
  },
  {
    q: "Wat gebeurt er als een instructeur kort van tevoren afzegt?",
    a: "De instructeur mag zelf een vervanger voorstellen, die de organisatie altijd eerst goedkeurt. Komt er geen goedgekeurde vervanger, dan geldt een oplopende annuleringsregeling (25%, 50% of 100% van de afgesproken vergoeding, afhankelijk van het moment van afzeggen). Het platform registreert dit; de verrekening loopt rechtstreeks tussen partijen. Andersom geldt een vergelijkbare regeling als de organisatie te laat annuleert.",
  },
  {
    q: "Wat kost het platform?",
    a: "€ 5 per maand (excl. btw) voor instructeurs en € 5 per vestiging per maand voor organisaties, na 30 dagen gratis proberen. Maandelijks opzegbaar.",
  },
  {
    q: "Wat is de conversievergoeding?",
    a: "Neemt een organisatie een instructeur die zij via het platform heeft leren kennen binnen 6 maanden vast in dienst, dan geldt een eenmalige bemiddelingsvergoeding van € 50 (excl. btw). De organisatie meldt dit via het platform.",
  },
  {
    q: "Hoe werken beoordelingen?",
    a: "Na een afgeronde opdracht geven beide partijen elkaar 1 tot 5 sterren. Beoordelingen worden pas zichtbaar nadat beide partijen hebben beoordeeld, zodat ze elkaar niet beïnvloeden.",
  },
  {
    q: "In welke regio werkt het platform?",
    a: "We starten in de Randstad. Andere regio's volgen later.",
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">
        Veelgestelde vragen
      </h1>
      <div className="mt-8 space-y-3">
        {faqs.map((faq) => (
          <details
            className="group rounded-lg border border-border bg-card"
            key={faq.q}
          >
            <summary className="cursor-pointer list-none px-5 py-4 font-medium marker:hidden [&::-webkit-details-marker]:hidden">
              {faq.q}
            </summary>
            <p className="border-t border-border px-5 py-4 text-sm text-muted-foreground">
              {faq.a}
            </p>
          </details>
        ))}
      </div>
    </div>
  );
}
