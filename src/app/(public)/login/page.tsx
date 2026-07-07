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

export default async function LoginPage() {
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
          <LoginForm />
          <div className="mt-4 space-y-1 text-sm text-muted-foreground">
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
                Registreer gratis
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
