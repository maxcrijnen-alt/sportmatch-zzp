import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/password-forms";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Wachtwoord vergeten",
};

export default function WachtwoordVergetenPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Wachtwoord vergeten</CardTitle>
          <CardDescription>
            Vul je e-mailadres in; we sturen je een link om een nieuw wachtwoord
            in te stellen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm />
          <p className="mt-4 text-sm text-muted-foreground">
            Toch weer bedacht?{" "}
            <Link className="font-medium text-primary hover:underline" href="/login">
              Terug naar inloggen
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
