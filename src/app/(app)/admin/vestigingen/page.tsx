import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { subscriptionStatusLabels } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { Subscription } from "@/types/database";

export const metadata: Metadata = {
  title: "Vestigingen",
};

interface LocationRow {
  id: string;
  name: string;
  postal_code: string;
  organization: { name: string } | null;
  city: { name: string } | null;
}

export default async function AdminVestigingenPage() {
  const supabase = await createClient();

  if (!supabase) {
    return null;
  }

  const [locationsResult, subscriptionsResult] = await Promise.all([
    supabase
      .from("organization_locations")
      .select(
        "id, name, postal_code, organization:organizations (name), city:cities (name)",
      )
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("subscriptions").select("*").not("location_id", "is", null),
  ]);

  const locations =
    (locationsResult.data as unknown as LocationRow[] | null) ?? [];
  const subscriptions =
    (subscriptionsResult.data as Subscription[] | null) ?? [];
  const subscriptionByLocation = new Map(
    subscriptions.map((subscription) => [subscription.location_id, subscription]),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Vestigingen</h1>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vestiging</TableHead>
              <TableHead>Organisatie</TableHead>
              <TableHead>Plaats</TableHead>
              <TableHead>Abonnement</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations.map((location) => {
              const subscription = subscriptionByLocation.get(location.id);
              return (
                <TableRow key={location.id}>
                  <TableCell className="font-medium">{location.name}</TableCell>
                  <TableCell>{location.organization?.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {location.city?.name}
                  </TableCell>
                  <TableCell>
                    {subscription ? (
                      <Badge
                        variant={
                          subscription.status === "active" ||
                          subscription.status === "trial"
                            ? "success"
                            : "destructive"
                        }
                      >
                        {subscriptionStatusLabels[subscription.status]}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
