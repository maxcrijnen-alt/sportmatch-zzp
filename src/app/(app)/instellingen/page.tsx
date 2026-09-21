import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionProfile } from "@/lib/auth/session";
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

      <Card>
        <CardHeader>
          <CardTitle>Agenda-integraties</CardTitle>
          <CardDescription>
            Beheer je SportMatch-agenda en gebruik een kalenderexport. Externe
            softwaresystemen worden pas als gekoppeld getoond wanneer er een
            echte verbinding actief is.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium">SportMatch agenda</p>
              <p className="text-xs text-muted-foreground">Openstaande, te beoordelen en bevestigde lessen op één plek.</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="success">Actief</Badge>
              <Link href="/agenda"><Button size="sm" variant="outline">Openen</Button></Link>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium">Externe kalender / ICS</p>
              <p className="text-xs text-muted-foreground">Exporteer je huidige agenda naar een kalenderapp.</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="accent">Beschikbaar</Badge>
              <a href="/agenda/export"><Button size="sm" variant="outline">ICS downloaden</Button></a>
            </div>
          </div>
          {[
            ["Gymly", "Nog niet gekoppeld"],
            ["SportBit", "Nog niet gekoppeld"],
          ].map(([provider, status]) => (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3" key={provider}>
              <p className="text-sm font-medium">{provider}</p>
              <Badge variant="muted">{status}</Badge>
            </div>
          ))}
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
    </div>
  );
}
