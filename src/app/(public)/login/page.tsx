import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LogoMark } from "@/components/brand/logo";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
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
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-12 sm:py-20">
      <div className="mb-6 text-center">
        <LogoMark className="mx-auto h-12 w-12" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Inloggen</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Welkom terug! Log in met je e-mailadres en wachtwoord.
        </p>
      </div>
      <Card className="shadow-raised">
        <CardContent className="p-6">
          {fout === "link-verlopen" ? (
            <Alert className="mb-4" variant="destructive">
              <AlertDescription>Deze link is ongeldig, verlopen of al gebruikt. Log in als je al bevestigd bent, of vraag bij wachtwoordherstel een nieuwe link aan.</AlertDescription>
            </Alert>
          ) : null}
          <LoginForm />
          <p className="mt-4 text-right text-sm">
            <Link
              className="font-medium text-primary hover:underline"
              href="/wachtwoord-vergeten"
            >
              Wachtwoord vergeten?
            </Link>
          </p>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-2 rounded-b-xl text-sm text-muted-foreground">
          <p>
            Nog geen account?{" "}
            <Link
              className="font-medium text-primary hover:underline"
              href="/registreren"
            >
              Start 30 dagen gratis
            </Link>
          </p>
          <p>
            <Link
              className="font-medium text-primary hover:underline"
              href="/demo"
            >
              Bekijk eerst een demo zonder account aan te maken
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
