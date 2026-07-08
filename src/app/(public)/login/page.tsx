import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionProfile } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Inloggen",
};

const demoEmails: Record<string, string> = {
  sportschool: "sportschool@sportmatch.test",
  instructeur: "instructeur@sportmatch.test",
};

const demoLabels: Record<string, string> = {
  sportschool: "sportschool-demo",
  instructeur: "instructeur-demo",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const profile = await getSessionProfile();

  if (profile) {
    redirect("/dashboard");
  }

  const { demo } = await searchParams;
  const defaultDemoEmail = demo ? demoEmails[demo] : undefined;
  const demoLabel = demo ? demoLabels[demo] : undefined;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            {defaultDemoEmail ? "Demo-login staat klaar" : "Inloggen"}
          </CardTitle>
          <CardDescription>
            {defaultDemoEmail
              ? `De ${demoLabel} is al ingevuld. Klik op Log in met demo-account om direct naar het dashboard te gaan.`
              : "Welkom terug! Log in met je e-mailadres en wachtwoord."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm defaultEmail={defaultDemoEmail} />
          {defaultDemoEmail ? (
            <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm leading-6 text-muted-foreground">
              Bekijk daarna eerst je dashboard en open vervolgens opdrachten,
              reacties of berichten. Zo zie je de volledige demo-route voordat
              je een eigen account aanmaakt.
            </div>
          ) : null}
          <div className="mt-4 space-y-1 text-sm text-muted-foreground">
            <p>
              <Link
                className="font-medium text-primary hover:underline"
                href="/demo"
              >
                Bekijk eerst een demo zonder account aan te maken
              </Link>
            </p>
            <p>
              <Link
                className="font-medium text-primary hover:underline"
                href="/wachtwoord-vergeten"
              >
                Wachtwoord vergeten?
              </Link>
            </p>
            <p>
              Nog geen account?{" "}
              <Link
                className="font-medium text-primary hover:underline"
                href="/registreren"
              >
                Start 30 dagen gratis
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
