import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ fout?: string }>;
}) {
  const { fout } = await searchParams;
  const profile = await getSessionProfile();

  if (profile) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Inloggen</CardTitle>
          <CardDescription>
            Welkom terug! Log in met je e-mailadres en wachtwoord.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fout === "link-verlopen" ? (
            <Alert className="mb-4" variant="destructive">
              <AlertDescription>Deze link is ongeldig, verlopen of al gebruikt. Log in als je al bevestigd bent, of vraag bij wachtwoordherstel een nieuwe link aan.</AlertDescription>
            </Alert>
          ) : null}
          <LoginForm />
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
