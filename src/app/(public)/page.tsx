import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Dumbbell,
  MapPin,
  MessageSquare,
  Search,
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

const exampleJobs = [
  {
    title: "Spoed-inval spinning",
    meta: "Vanavond 19:00 · Utrecht",
    details: "Les van 45 minuten voor 18 deelnemers. Ervaring met groepslessen gewenst.",
    pay: "€ 55-€ 70",
  },
  {
    title: "Terugkerende yoga-ochtend",
    meta: "Elke dinsdag · Den Haag",
    details: "Rustige hatha-les voor beginners. Vervanging voor 6 weken.",
    pay: "€ 45-€ 60",
  },
  {
    title: "Tijdelijke fitnesscoach",
    meta: "3 dagen per week · Rotterdam",
    details: "Begeleiding op de vloer, intakegesprekken en trainingsschema's.",
    pay: "In overleg",
  },
];

const steps = [
  {
    icon: Users,
    title: "Maak je profiel",
    text: "Sportscholen voegen vestigingen toe. Instructeurs vullen specialisaties, reisafstand, diploma's en beschikbaarheid in.",
  },
  {
    icon: CalendarClock,
    title: "Plaats of vind werk",
    text: "Plaats een opdracht of bekijk passende lessen, invaldiensten en tijdelijke functies in je regio.",
  },
  {
    icon: MessageSquare,
    title: "Stem veilig af",
    text: "Chat via het platform, vergelijk kandidaten, reageer met een voorstel en leg afspraken duidelijk vast.",
  },
  {
    icon: Star,
    title: "Bevestig en beoordeel",
    text: "Na digitale bevestiging worden contactgegevens gedeeld. Na afloop bouwen beide partijen aan betrouwbare reviews.",
  },
];

const schoolBenefits = [
  "Plaats spoed-inval, losse lessen, reeksen of vacatures vanaf één plek.",
  "Zie snel wie past op afstand, specialisatie, ervaring en beoordeling.",
  "Beheer meerdere vestigingen en planners zonder losse appgroepen.",
  "Deel contactgegevens pas nadat de opdracht door beide partijen is bevestigd.",
];

const instructorBenefits = [
  "Vind opdrachten die passen bij jouw sport, agenda en maximale reisafstand.",
  "Reageer direct of doe een tegenvoorstel als tarief of tijd niet past.",
  "Toon gecontroleerde diploma's, VOG, EHBO/BHV en verzekering als badges.",
  "Bouw reviews op zonder commissie over je afgesproken opdrachtvergoeding.",
];

const trustItems = [
  {
    icon: ShieldCheck,
    title: "Documentcontrole",
    text: "Diploma's, VOG, EHBO/BHV en verzekeringen kunnen handmatig worden gecontroleerd en als badges zichtbaar worden.",
  },
  {
    icon: BadgeCheck,
    title: "Duidelijke bevestiging",
    text: "Een opdracht is pas definitief wanneer beide partijen digitaal akkoord zijn met de samenvatting van de afspraken.",
  },
  {
    icon: Star,
    title: "Reviews na afloop",
    text: "Beoordelingen worden pas zichtbaar nadat beide partijen hebben beoordeeld. Dat houdt feedback eerlijker.",
  },
];

const faqs = [
  {
    q: "Voor wie is SportMatch ZZP?",
    a: "Voor sportscholen, studio's en sportorganisaties die instructeurs zoeken, en voor instructeurs die losse opdrachten, invalwerk, terugkerende lessen of tijdelijke functies willen vinden.",
  },
  {
    q: "Hoe start ik als sportschool?",
    a: "Maak een organisatieaccount aan, voeg je vestiging(en) toe en plaats je eerste opdracht. Daarna kun je kandidaten vergelijken, chatten en digitaal bevestigen.",
  },
  {
    q: "Hoe start ik als instructeur?",
    a: "Maak een instructeursprofiel, vul je sporten, regio, beschikbaarheid en documenten in en reageer op passende opdrachten.",
  },
  {
    q: "Loopt betaling via SportMatch ZZP?",
    a: "Nee. De opdrachtvergoeding spreek je samen af en wordt rechtstreeks tussen sportschool en instructeur betaald. Het platform rekent geen commissie over die vergoeding.",
  },
  {
    q: "Wat kost het na de gratis periode?",
    a: "Na 30 dagen gratis proberen kost het € 5 per maand excl. btw voor instructeurs en € 5 per vestiging per maand excl. btw voor sportorganisaties. Maandelijks opzegbaar.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-secondary text-secondary-foreground">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="space-y-6">
            <Badge className="w-fit" variant="accent">
              30 dagen gratis proberen in de {BRAND.region}
            </Badge>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                De snelle match tussen sportschool en sportinstructeur.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-secondary-foreground/80">
                {BRAND.name} helpt sportorganisaties om lessen gevuld te krijgen
                en instructeurs om passende opdrachten te vinden: spoed-inval,
                losse lessen, terugkerende reeksen, tijdelijke functies en
                vacatures.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/registreren?rol=organisatie">
                <Button className="w-full sm:w-auto" size="lg">
                  Start als sportschool
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/registreren?rol=instructeur">
                <Button
                  className="w-full border-secondary-foreground/30 bg-transparent text-secondary-foreground hover:bg-secondary-foreground/10 sm:w-auto"
                  size="lg"
                  variant="outline"
                >
                  Start als instructeur
                </Button>
              </Link>
              <Link href="/demo">
                <Button
                  className="w-full border-secondary-foreground/30 bg-transparent text-secondary-foreground hover:bg-secondary-foreground/10 sm:w-auto"
                  size="lg"
                  variant="outline"
                >
                  Bekijk eerst demo
                </Button>
              </Link>
            </div>
            <div className="grid gap-3 text-sm text-secondary-foreground/75 sm:grid-cols-3">
              <p className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                Geen commissie op opdrachtvergoeding
              </p>
              <p className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                Documentbadges en reviews
              </p>
              <p className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                Chat en digitale bevestiging
              </p>
            </div>
            <p className="text-sm text-secondary-foreground/65">
              Daarna € 5 p/m excl. btw voor instructeurs en € 5 per vestiging
              p/m excl. btw voor sportorganisaties. Maandelijks opzegbaar.
            </p>
          </div>

          <div className="rounded-lg border border-secondary-foreground/15 bg-background p-4 text-foreground shadow-xl sm:p-5">
            <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
              <div>
                <p className="text-sm font-semibold">Voorbeeldopdrachten</p>
                <p className="text-sm text-muted-foreground">
                  Dit kan vandaag op je bord staan
                </p>
              </div>
              <Badge variant="muted">Randstad</Badge>
            </div>
            <div className="mt-4 space-y-3">
              {exampleJobs.map((job) => (
                <div
                  className="rounded-md border border-border bg-card p-4"
                  key={job.title}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-base font-semibold leading-tight">
                        {job.title}
                      </h2>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        {job.meta}
                      </p>
                    </div>
                    <span className="w-fit rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                      {job.pay}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {job.details}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Voor wie */}
      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:py-16">
        <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
          <div className="lg:pr-6">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Eén platform voor twee kanten van hetzelfde rooster
            </h2>
            <p className="mt-3 text-muted-foreground">
              Minder zoeken, minder losse berichten en sneller duidelijkheid
              over wie waar wanneer les kan geven.
            </p>
          </div>
          <Card className="h-full">
            <CardHeader>
              <Building2 className="h-8 w-8 text-primary" />
              <CardTitle className="text-xl">Voor sportscholen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Vul gaten in je rooster, vind vervanging bij ziekte en bouw een
                flexibele poule van betrouwbare instructeurs op.
              </p>
              <Link href="/voor-sportscholen">
                <Button className="mt-2" variant="outline">
                  Bekijk sportschool-route
                </Button>
              </Link>
            </CardContent>
          </Card>
          <Card className="h-full">
            <CardHeader>
              <Dumbbell className="h-8 w-8 text-primary" />
              <CardTitle className="text-xl">Voor instructeurs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Vind opdrachten die passen bij jouw sport, agenda, tarief en
                reisafstand, zonder commissie over je opdrachtvergoeding.
              </p>
              <Link href="/voor-instructeurs">
                <Button className="mt-2" variant="outline">
                  Bekijk instructeur-route
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Concrete voorbeelden */}
      <section className="bg-muted/50">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:py-16">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Concrete opdrachten waarvoor je SportMatch ZZP gebruikt
            </h2>
            <p className="mt-3 text-muted-foreground">
              Niet alleen voor nood. Ook handig voor terugkerende lessen,
              tijdelijke drukte en vaste vacatures.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {exampleJobs.map((job) => (
              <Card key={job.title}>
                <CardHeader>
                  <CardTitle className="text-lg">{job.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{job.meta}</p>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                  <p>{job.details}</p>
                  <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
                    <span className="font-medium text-foreground">{job.pay}</span>
                    <span className="text-xs">Voorbeeld</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Sportscholen en instructeurs */}
      <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-14 sm:py-16 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8">
          <Timer className="h-8 w-8 text-primary" />
          <h2 className="mt-4 text-2xl font-bold tracking-tight">
            Sportschool: plaats je opdracht en vergelijk reacties
          </h2>
          <p className="mt-3 text-muted-foreground">
            Zet je invalvraag of roosterplek duidelijk neer en laat instructeurs
            reageren met beschikbaarheid, tarief en eventuele opmerkingen.
          </p>
          <div className="mt-6 space-y-3">
            {schoolBenefits.map((benefit) => (
              <p className="flex gap-3 text-sm" key={benefit}>
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{benefit}</span>
              </p>
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/registreren?rol=organisatie">
              <Button className="w-full sm:w-auto">Start als sportschool</Button>
            </Link>
            <Link href="/voor-sportscholen">
              <Button className="w-full sm:w-auto" variant="outline">
                Meer voor sportscholen
              </Button>
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8">
          <Search className="h-8 w-8 text-primary" />
          <h2 className="mt-4 text-2xl font-bold tracking-tight">
            Instructeur: vind werk dat bij je past
          </h2>
          <p className="mt-3 text-muted-foreground">
            Maak zichtbaar waar je goed in bent, welke documenten gecontroleerd
            zijn en op welke opdrachten je wilt reageren.
          </p>
          <div className="mt-6 space-y-3">
            {instructorBenefits.map((benefit) => (
              <p className="flex gap-3 text-sm" key={benefit}>
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{benefit}</span>
              </p>
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/registreren?rol=instructeur">
              <Button className="w-full sm:w-auto">Start als instructeur</Button>
            </Link>
            <Link href="/voor-instructeurs">
              <Button className="w-full sm:w-auto" variant="outline">
                Meer voor instructeurs
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Hoe het werkt */}
      <section className="bg-secondary text-secondary-foreground">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:py-16">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Zo werkt het in vier stappen
              </h2>
              <p className="mt-3 max-w-2xl text-secondary-foreground/75">
                Van eerste profiel tot bevestigde opdracht. Contactgegevens
                blijven verborgen tot beide partijen akkoord zijn.
              </p>
            </div>
            <Link href="/hoe-het-werkt">
              <Button
                className="w-full border-secondary-foreground/30 bg-transparent text-secondary-foreground hover:bg-secondary-foreground/10 sm:w-auto"
                variant="outline"
              >
                Bekijk alle stappen
              </Button>
            </Link>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <div
                className="rounded-lg border border-secondary-foreground/15 bg-secondary-foreground/[0.03] p-5"
                key={step.title}
              >
                <div className="mb-5 flex items-center justify-between gap-3">
                  <step.icon className="h-7 w-7 text-accent" />
                  <span className="text-sm text-secondary-foreground/50">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-secondary-foreground/70">
                  {step.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Vertrouwen */}
      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:py-16">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Vertrouwen en veiligheid zonder valse beloftes
            </h2>
            <p className="mt-3 text-muted-foreground">
              Het platform helpt met controle, afspraken en reviews. De
              juridische en fiscale verantwoordelijkheid blijft bij de partijen
              zelf.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {trustItems.map((item) => (
              <div key={item.title}>
                <item.icon className="mb-3 h-8 w-8 text-primary" />
                <h3 className="mb-2 font-semibold">{item.title}</h3>
                <p className="text-sm leading-6 text-muted-foreground">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        <Alert className="mt-10" variant="info">
          <AlertTitle>Belangrijk om te weten</AlertTitle>
          <AlertDescription>
            {BRAND.name} is een matchingplatform en geen juridisch of fiscaal
            adviseur. De betaling voor de opdracht zelf verloopt rechtstreeks
            tussen organisatie en instructeur. Documentcontrole is ondersteunend
            en geen absolute garantie. Gebruikers blijven zelf verantwoordelijk
            voor contracten, belastingen, verzekeringen en naleving van wet- en
            regelgeving.
          </AlertDescription>
        </Alert>
      </section>

      {/* Tarieven */}
      <section className="bg-muted/50">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-14 sm:py-16 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge className="mb-4 w-fit" variant="accent">
              30 dagen gratis
            </Badge>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Daarna simpel: € 5 per maand excl. btw
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Voor instructeurs geldt € 5 p/m excl. btw. Voor sportorganisaties
              geldt € 5 per vestiging p/m excl. btw. Geen commissie over de
              afgesproken opdrachtvergoeding.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:shrink-0">
            <Link href="/registreren">
              <Button className="w-full sm:w-auto" size="lg">
                Start gratis
              </Button>
            </Link>
            <Link href="/tarieven">
              <Button className="w-full sm:w-auto" size="lg" variant="outline">
                Bekijk tarieven
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto w-full max-w-4xl px-4 py-14 sm:py-16">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Veelgestelde vragen
          </h2>
          <p className="mt-3 text-muted-foreground">
            De belangrijkste vragen voordat je start.
          </p>
        </div>
        <div className="mt-8 space-y-3">
          {faqs.map((faq) => (
            <details
              className="group rounded-lg border border-border bg-card"
              key={faq.q}
            >
              <summary className="cursor-pointer list-none px-5 py-4 font-medium marker:hidden [&::-webkit-details-marker]:hidden">
                {faq.q}
              </summary>
              <p className="border-t border-border px-5 py-4 text-sm leading-6 text-muted-foreground">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 px-4 py-14 text-center sm:py-16">
          <Clock3 className="h-9 w-9" />
          <h2 className="max-w-2xl text-2xl font-bold sm:text-3xl">
            Maak vandaag je profiel aan en probeer SportMatch ZZP 30 dagen gratis.
          </h2>
          <p className="max-w-2xl text-primary-foreground/85">
            Kies je rol, vul de basis in en start met plaatsen of reageren zodra
            je profiel klaar is. Eerst rondkijken kan ook met de demo.
          </p>
          <div className="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
            <Link href="/registreren?rol=organisatie">
              <Button
                className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 sm:w-auto"
                size="lg"
              >
                Ik zoek instructeurs
              </Button>
            </Link>
            <Link href="/registreren?rol=instructeur">
              <Button
                className="w-full border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 sm:w-auto"
                size="lg"
                variant="outline"
              >
                Ik zoek opdrachten
              </Button>
            </Link>
            <Link href="/demo">
              <Button
                className="w-full border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 sm:w-auto"
                size="lg"
                variant="outline"
              >
                Eerst demo bekijken
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
