import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionProfile } from "@/lib/auth/session";
import { signOutAction } from "@/lib/auth/actions";
import { BRAND } from "@/lib/branding";

export const metadata: Metadata = {
  title: "Instellingen",
};

export default async function InstellingenPage() {
  const profile = await getSessionProfile();

  if (!profile) {
    redirect("/login");
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Instellingen</h1>
        <p className="text-sm text-muted-foreground">
          Account- en notificatie-instellingen.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notificaties</CardTitle>
          <CardDescription>
            Je ontvangt in-app meldingen voor reacties, uitnodigingen,
            tegenvoorstellen, bevestigingen, annuleringen en chatberichten.
            E-mailnotificaties worden geactiveerd zodra de e-mailprovider is
            gekoppeld.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/meldingen">
            <Button variant="outline">Bekijk je meldingen</Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Abonnement</CardTitle>
          <CardDescription>
            Bekijk of wijzig je abonnement en proefperiode.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/abonnement">
            <Button variant="outline">Naar abonnement</Button>
          </Link>
        </CardContent>
      </Card>

      <Alert>
        <AlertTitle>Verantwoord gebruik</AlertTitle>
        <AlertDescription>
          {BRAND.name} faciliteert matching en communicatie. Je blijft zelf
          verantwoordelijk voor contracten, belastingen, verzekeringen en
          naleving van wet- en regelgeving.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Uitloggen</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={signOutAction}>
            <Button type="submit" variant="destructive">
              Uitloggen
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
