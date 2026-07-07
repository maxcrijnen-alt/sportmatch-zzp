import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, Dumbbell, ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Demo bekijken",
  description:
    "Bekijk SportMatch ZZP met demo-accounts voordat je een eigen account aanmaakt.",
};

const demoAccounts = [
  {
    title: "Bekijk als sportschool",
    role: "Eigenaar FitZone Utrecht",
    description:
      "Zie open opdrachten, reacties van instructeurs, vestigingen, kandidaten en berichten vanuit de organisatiekant.",
    href: "/login?demo=sportschool",
    icon: Building2,
    highlights: ["Opdrachten beheren", "Kandidaten vergelijken", "Vestigingen bekijken"],
  },
  {
    title: "Bekijk als instructeur",
    role: "Instructeur met historie en badges",
    description:
      "Ervaar hoe passende opdrachten, reacties, documenten, reviews en berichten eruitzien voor een instructeur.",
    href: "/login?demo=instructeur",
    icon: Dumbbell,
    highlights: ["Passende opdrachten", "Documentbadges", "Reviews en berichten"],
  },
  {
    title: "Bekijk als planner",
    role: "Planner bij FitZone Utrecht",
    description:
      "Bekijk hoe een teamlid binnen een sportschool opdrachten en kandidaten kan volgen zonder eigenaar te zijn.",
    href: "/login?demo=planner",
    icon: Users,
    highlights: ["Teamrol testen", "Opdrachten volgen", "Berichten bekijken"],
  },
  {
    title: "Bekijk als admin",
    role: "Beheerder",
    description:
      "Controleer de beheeromgeving voor gebruikers, documenten, organisaties, opdrachten en reviews.",
    href: "/login?demo=admin",
    icon: ShieldCheck,
    highlights: ["Documentcontrole", "Gebruikersbeheer", "Platformoverzicht"],
  },
];

export default function DemoPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:py-16">
      <div className="max-w-3xl space-y-4">
        <Badge className="w-fit" variant="accent">
          Geen eigen account nodig
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
          Bekijk eerst hoe SportMatch ZZP van binnen voelt.
        </h1>
        <p className="text-lg leading-8 text-muted-foreground">
          Kies een demo-rol. De login wordt automatisch ingevuld met een bestaand
          demo-account, zodat je direct de dashboards, opdrachten, reacties en
          berichten kunt bekijken.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {demoAccounts.map((account) => {
          const Icon = account.icon;

          return (
            <Card key={account.href}>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-primary/10 p-2 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{account.title}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {account.role}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="text-sm leading-6 text-muted-foreground">
                  {account.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {account.highlights.map((highlight) => (
                    <span
                      className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                      key={highlight}
                    >
                      {highlight}
                    </span>
                  ))}
                </div>
                <Link href={account.href}>
                  <Button className="w-full sm:w-auto">
                    Open demo-login
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        <p>
          Alle demo-accounts gebruiken hetzelfde wachtwoord: SportMatch2026! De
          knop hierboven vult dit automatisch in op de loginpagina.
        </p>
      </div>
    </div>
  );
}
