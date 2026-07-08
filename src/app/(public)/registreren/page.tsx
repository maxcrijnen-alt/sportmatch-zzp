import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Building2, CheckCircle2, Dumbbell, PlayCircle } from "lucide-react";
import { RegisterForm } from "@/components/auth/register-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionProfile } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Registreren",
};

const roleCards = [
  {
    title: "Ik ben sportschool",
    text: "Maak een organisatie aan, voeg je eerste vestiging toe en plaats daarna je eerste opdracht.",
    href: "/registreren?rol=organisatie",
    icon: Building2,
  },
  {
    title: "Ik ben instructeur",
    text: "Vul je specialisaties, beschikbaarheid, reisafstand en documenten in om passende opdrachten te vinden.",
    href: "/registreren?rol=instructeur",
    icon: Dumbbell,
  },
];

const onboardingSteps = [
  "Eerst demo bekijken kan zonder eigen account.",
  "Account aanmaken met naam, e-mail en wachtwoord.",
  "Profiel afronden zodat matches en opdrachten logisch voelen.",
];

export default async function RegistrerenPage({
  searchParams,
}: {
  searchParams: Promise<{ rol?: string }>;
}) {
  const profile = await getSessionProfile();

  if (profile) {
    redirect("/dashboard");
  }

  const { rol } = await searchParams;
  const defaultRole = rol === "organisatie" ? "organization" : "instructor";

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-start lg:py-16">
      <section className="space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-medium text-primary">30 dagen gratis starten</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Kies hoe je SportMatch ZZP wilt gebruiken.
          </h1>
          <p className="text-muted-foreground">
            Je kunt eerst met een demo-account rondkijken. Wil je daarna verder,
            dan maak je een kort account aan en rond je gericht je profiel af.
          </p>
        </div>

        <Link
          className="group block rounded-lg border border-primary/30 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
          href="/demo"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-primary/10 p-2 text-primary">
              <PlayCircle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold">Eerst demo bekijken</h2>
                <ArrowRight className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
              </div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Bekijk het platform als sportschool of instructeur voordat je
                zelf een account aanmaakt.
              </p>
            </div>
          </div>
        </Link>

        <div className="grid gap-3">
          {roleCards.map((card) => {
            const Icon = card.icon;

            return (
              <Link
                className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary hover:bg-primary/5"
                href={card.href}
                key={card.title}
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-primary/10 p-2 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="font-semibold">{card.title}</h2>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {card.text}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <p className="font-medium">Wat gebeurt er als je echt start?</p>
          <div className="mt-3 space-y-2">
            {onboardingSteps.map((step) => (
              <p className="flex gap-2 text-sm text-muted-foreground" key={step}>
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{step}</span>
              </p>
            ))}
          </div>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Gratis account aanmaken</CardTitle>
          <CardDescription>
            Kies je rol, vul je basisgegevens in en rond daarna je profiel af.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RegisterForm defaultRole={defaultRole} />
          <p className="mt-4 text-sm text-muted-foreground">
            Eerst kijken?{" "}
            <Link className="font-medium text-primary hover:underline" href="/demo">
              Open de demo
            </Link>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Al een account?{" "}
            <Link className="font-medium text-primary hover:underline" href="/login">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
