import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, organizationTypeLabels } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { Organization } from "@/types/database";

export const metadata: Metadata = {
  title: "Organisaties",
};

interface OrgRow extends Organization {
  created_at: string;
  locationCount: number;
}

export default async function AdminOrganisatiesPage() {
  const supabase = await createClient();

  if (!supabase) {
    return null;
  }

  const [{ data }, { data: locationRows }] = await Promise.all([
    supabase
      .rpc("admin_list_organizations")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("organization_locations").select("organization_id"),
  ]);

  const locationCounts = new Map<string, number>();
  for (const location of locationRows ?? []) {
    const organizationId = location.organization_id as string;
    locationCounts.set(
      organizationId,
      (locationCounts.get(organizationId) ?? 0) + 1,
    );
  }

  const organizations = ((data as unknown as Organization[] | null) ?? []).map(
    (organization) => ({
      ...organization,
      locationCount: locationCounts.get(organization.id) ?? 0,
    }),
  ) as OrgRow[];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Organisaties</h1>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Naam</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>KvK</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Vestigingen</TableHead>
              <TableHead>Sinds</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {organizations.map((organization) => (
              <TableRow key={organization.id}>
                <TableCell className="font-medium">{organization.name}</TableCell>
                <TableCell className="text-sm">
                  {organizationTypeLabels[organization.org_type]}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {organization.kvk_number || "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {organization.contact_email}
                </TableCell>
                <TableCell>{organization.locationCount}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(organization.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
