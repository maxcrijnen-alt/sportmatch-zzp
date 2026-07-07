import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  adminSetSubscriptionStatusAction,
  updateConversionFeeStatusAction,
} from "@/lib/admin/actions";
import {
  conversionFeeStatusLabels,
  formatDate,
  formatEuro,
  subscriptionStatusLabels,
} from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type {
  ConversionFee,
  ConversionFeeStatus,
  Subscription,
  SubscriptionStatus,
} from "@/types/database";

export const metadata: Metadata = {
  title: "Billing",
};

interface SubscriptionRow extends Subscription {
  location: { name: string; organization: { name: string } | null } | null;
}

interface FeeRow extends ConversionFee {
  organization: { name: string } | null;
}

export default async function AdminBillingPage() {
  const supabase = await createClient();

  if (!supabase) {
    return null;
  }

  const [subscriptionsResult, feesResult, instructorNamesResult] =
    await Promise.all([
      supabase
        .from("subscriptions")
        .select(
          `*,
          location:organization_locations (name, organization:organizations (name))`,
        )
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("conversion_fees")
        .select("*, organization:organizations (name)")
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name").limit(1000),
    ]);

  const subscriptions =
    (subscriptionsResult.data as unknown as SubscriptionRow[] | null) ?? [];
  const fees = (feesResult.data as unknown as FeeRow[] | null) ?? [];
  const namesById = new Map(
    (instructorNamesResult.data ?? []).map((row) => [
      row.id as string,
      row.full_name as string,
    ]),
  );

  const subscriptionStatuses = Object.keys(
    subscriptionStatusLabels,
  ) as SubscriptionStatus[];
  const feeStatuses = Object.keys(
    conversionFeeStatusLabels,
  ) as ConversionFeeStatus[];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Billing</h1>

      <Card>
        <CardHeader>
          <CardTitle>Abonnementen</CardTitle>
          <CardDescription>
            Pas billingstatussen handmatig aan. “Betaling mislukt” geeft
            automatisch 14 dagen hersteltermijn.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {subscriptions.map((subscription) => {
            const owner = subscription.instructor_id
              ? `Instructeur: ${namesById.get(subscription.instructor_id) ?? "?"}`
              : `${subscription.location?.organization?.name ?? "?"} — ${subscription.location?.name ?? "?"}`;

            return (
              <form
                action={adminSetSubscriptionStatusAction.bind(
                  null,
                  subscription.id,
                )}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                key={subscription.id}
              >
                <div>
                  <p className="text-sm font-medium">{owner}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatEuro(subscription.price_cents)}/maand · proefperiode
                    tot {formatDate(subscription.trial_ends_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="muted">
                    {subscriptionStatusLabels[subscription.status]}
                  </Badge>
                  <Select
                    className="h-8 w-44 text-xs"
                    defaultValue={subscription.status}
                    name="status"
                  >
                    {subscriptionStatuses.map((status) => (
                      <option key={status} value={status}>
                        {subscriptionStatusLabels[status]}
                      </option>
                    ))}
                  </Select>
                  <Button size="sm" type="submit" variant="outline">
                    Wijzigen
                  </Button>
                </div>
              </form>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conversievergoedingen</CardTitle>
          <CardDescription>
            Gemelde vaste aannames (€ 50 excl. btw per aanname). Statussen:
            gemeld → gecontroleerd → gefactureerd → betaald.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {fees.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nog geen meldingen.</p>
          ) : (
            fees.map((fee) => (
              <form
                action={updateConversionFeeStatusAction.bind(null, fee.id)}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                key={fee.id}
              >
                <div>
                  <p className="text-sm font-medium">
                    {fee.organization?.name} →{" "}
                    {namesById.get(fee.instructor_id) ?? "?"} ·{" "}
                    {formatEuro(fee.amount_cents)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Gemeld op {formatDate(fee.created_at)}
                    {fee.note ? ` · ${fee.note}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    className="h-8 w-40 text-xs"
                    defaultValue={fee.status}
                    name="status"
                  >
                    {feeStatuses.map((status) => (
                      <option key={status} value={status}>
                        {conversionFeeStatusLabels[status]}
                      </option>
                    ))}
                  </Select>
                  <Button size="sm" type="submit" variant="outline">
                    Wijzigen
                  </Button>
                </div>
              </form>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
