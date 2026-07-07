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
  locations: { count: number }[];
}

export default async function AdminOrganisatiesPage() {
  const supabase = await createClient();

  if (!supabase) {
    return null;
  }

  const { data } = await supabase
    .from("organizations")
    .select("*, locations:organization_locations (count)")
    .order("created_at", { ascending: false })
    .limit(200);

  const organizations = (data as unknown as OrgRow[] | null) ?? [];

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
                <TableCell>{organization.locations?.[0]?.count ?? 0}</TableCell>
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
