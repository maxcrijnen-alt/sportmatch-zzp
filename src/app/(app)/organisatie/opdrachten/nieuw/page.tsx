import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CreateJobForm } from "@/components/jobs/create-job-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionProfile } from "@/lib/auth/session";
import { subscriptionGrantsAccess } from "@/lib/billing/access";
import { getOrgContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
import type { Qualification, Sport, Subscription } from "@/types/database";

export const metadata: Metadata = {
  title: "Nieuwe opdracht",
};

export default async function NieuweOpdrachtPage() {
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

  const [sportsResult, qualificationsResult, subscriptionsResult] =
    await Promise.all([
      supabase.from("sports").select("*").eq("is_active", true).order("name"),
      supabase
        .from("qualifications")
        .select("*")
        .eq("is_active", true)
        .order("name"),
      locationIds.length > 0
        ? supabase.from("subscriptions").select("*").in("location_id", locationIds)
        : Promise.resolve({ data: [] }),
    ]);

  const subscriptions =
    (subscriptionsResult.data as Subscription[] | null) ?? [];
  const activeLocations = orgContext.locations.filter((location) =>
    subscriptionGrantsAccess(
      subscriptions.find((subscription) => subscription.location_id === location.id),
    ),
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nieuwe opdracht</h1>
        <p className="text-sm text-muted-foreground">
          Plaats een opdracht of vacature voor {orgContext.organization.name}.
        </p>
      </div>

      {activeLocations.length === 0 ? (
        <Alert variant="warning">
          <AlertTitle>Geen vestiging met actieve toegang</AlertTitle>
          <AlertDescription>
            Om een opdracht te plaatsen heeft minimaal één vestiging een actieve
            proefperiode of een actief abonnement nodig. Bekijk je abonnementen
            op de abonnementspagina.
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Opdrachtgegevens</CardTitle>
            <CardDescription>
              Hoe duidelijker de opdracht, hoe beter de reacties.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateJobForm
              defaultContactName={profile.full_name}
              locations={activeLocations}
              qualifications={
                (qualificationsResult.data as Qualification[]) ?? []
              }
              sports={(sportsResult.data as Sport[]) ?? []}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
