import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MapPin } from "lucide-react";
import { AddLocationForm } from "@/components/org/org-forms";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionProfile } from "@/lib/auth/session";
import { subscriptionGrantsAccess } from "@/lib/billing/access";
import { subscriptionStatusLabels } from "@/lib/labels";
import { getOrgContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
import type { City, Subscription } from "@/types/database";

export const metadata: Metadata = {
  title: "Vestigingen",
};

export default async function VestigingenPage() {
  const profile = await getSessionProfile();
  const orgContext = await getOrgContext();
  const supabase = await createClient();

  if (!profile || !supabase) {
    redirect("/login");
  }

  if (!orgContext) {
    redirect("/dashboard");
  }

  const locationIds = orgContext.locations.map((location) => location.id);

  const [citiesResult, subscriptionsResult] = await Promise.all([
    supabase.from("cities").select("*").order("name"),
    locationIds.length > 0
      ? supabase.from("subscriptions").select("*").in("location_id", locationIds)
      : Promise.resolve({ data: [] }),
  ]);

  const cities = (citiesResult.data as City[] | null) ?? [];
  const subscriptions =
    (subscriptionsResult.data as Subscription[] | null) ?? [];

  // Plaatsnamen opzoeken voor weergave
  const cityNameById = new Map(cities.map((city) => [city.id, city.name]));

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Vestigingen</h1>
        <p className="text-sm text-muted-foreground">
          Elke vestiging heeft een eigen abonnement van € 5 per maand (excl.
          btw) na 30 dagen gratis.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Huidige vestigingen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {orgContext.locations.map((location) => {
            const subscription = subscriptions.find(
              (item) => item.location_id === location.id,
            );
            const hasAccess = subscriptionGrantsAccess(subscription);

            return (
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                key={location.id}
              >
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{location.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {location.street} {location.house_number},{" "}
                      {location.postal_code}{" "}
                      {cityNameById.get(location.city_id) ?? ""}
                    </p>
                  </div>
                </div>
                {subscription ? (
                  <Badge variant={hasAccess ? "success" : "destructive"}>
                    {subscriptionStatusLabels[subscription.status]}
                  </Badge>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {orgContext.memberRole === "owner" ? (
        <Card>
          <CardHeader>
            <CardTitle>Vestiging toevoegen</CardTitle>
            <CardDescription>
              Nieuwe vestigingen krijgen automatisch een gratis proefperiode.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AddLocationForm cities={cities} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
