import type { Metadata } from "next";
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
import {
  subscriptionGrantsAccess,
  subscriptionStatusDescription,
} from "@/lib/billing/access";
import {
  cancelSubscriptionAction,
  mockActivateSubscriptionAction,
} from "@/lib/billing/actions";
import { formatEuro, subscriptionStatusLabels } from "@/lib/labels";
import { getOrgContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
import type { Subscription } from "@/types/database";

export const metadata: Metadata = {
  title: "Abonnement",
};

function SubscriptionCard({
  subscription,
  title,
  canManage,
}: {
  subscription: Subscription;
  title: string;
  canManage: boolean;
}) {
  const hasAccess = subscriptionGrantsAccess(subscription);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{title}</CardTitle>
          <Badge variant={hasAccess ? "success" : "destructive"}>
            {subscriptionStatusLabels[subscription.status]}
          </Badge>
        </div>
        <CardDescription>
          {subscriptionStatusDescription(subscription)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {formatEuro(subscription.price_cents)} per maand (excl. btw),
          maandelijks opzegbaar.
        </p>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            {!hasAccess || subscription.status === "trial" ? (
              <form
                action={mockActivateSubscriptionAction.bind(null, subscription.id)}
              >
                <Button size="sm" type="submit">
                  Abonnement activeren (testbetaling)
                </Button>
              </form>
            ) : null}
            {subscription.status === "active" ||
            subscription.status === "trial" ? (
              <form action={cancelSubscriptionAction.bind(null, subscription.id)}>
                <Button size="sm" type="submit" variant="outline">
                  Opzeggen
                </Button>
              </form>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Alleen de eigenaar van de organisatie kan abonnementen beheren.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default async function AbonnementPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile || !supabase) {
    redirect("/login");
  }

  const orgContext =
    profile.role === "organization" ? await getOrgContext() : null;

  let cards: React.ReactNode;

  if (orgContext) {
    const locationIds = orgContext.locations.map((location) => location.id);
    const { data } =
      locationIds.length > 0
        ? await supabase
            .from("subscriptions")
            .select("*")
            .in("location_id", locationIds)
        : { data: [] };

    const subscriptions = (data as Subscription[] | null) ?? [];
    const canManage = orgContext.memberRole === "owner";

    cards = orgContext.locations.map((location) => {
      const subscription = subscriptions.find(
        (item) => item.location_id === location.id,
      );
      return subscription ? (
        <SubscriptionCard
          canManage={canManage}
          key={location.id}
          subscription={subscription}
          title={location.name}
        />
      ) : null;
    });
  } else {
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("instructor_id", profile.id)
      .maybeSingle();

    const subscription = data as Subscription | null;

    cards = subscription ? (
      <SubscriptionCard
        canManage
        subscription={subscription}
        title="Jouw abonnement"
      />
    ) : (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Geen abonnement gevonden. Rond eerst je profiel af.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Abonnement</h1>
        <p className="text-sm text-muted-foreground">
          {orgContext
            ? "Elke vestiging heeft een eigen abonnement."
            : "Je abonnement en proefperiode."}
        </p>
      </div>

      <Alert>
        <AlertTitle>Testfase: geen echte betalingen</AlertTitle>
        <AlertDescription>
          Tijdens de MVP-fase worden betalingen gesimuleerd. “Activeren” zet je
          abonnement direct op actief zonder echte transactie. Bij een verlopen
          abonnement blijven bestaande afspraken zichtbaar, maar zijn reageren,
          chatten, plaatsen en bevestigen geblokkeerd. Bij een mislukte betaling
          geldt straks een hersteltermijn van 14 dagen.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">{cards}</div>
    </div>
  );
}
