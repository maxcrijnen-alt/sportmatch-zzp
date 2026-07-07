import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fetchAdminStats } from "@/lib/admin/stats";

export const metadata: Metadata = {
  title: "Admin",
};

export default async function AdminPage() {
  const stats = await fetchAdminStats();

  const tiles = stats
    ? [
        { label: "Instructeurs", value: stats.instructors, href: "/admin/gebruikers?rol=instructor" },
        { label: "Organisaties", value: stats.organizations, href: "/admin/organisaties" },
        { label: "Vestigingen", value: stats.locations, href: "/admin/vestigingen" },
        { label: "Opdrachten totaal", value: stats.jobsTotal, href: "/admin/opdrachten" },
        { label: "Open opdrachten", value: stats.jobsOpen, href: "/admin/opdrachten" },
        { label: "Bevestigde opdrachten", value: stats.jobsConfirmed, href: "/admin/opdrachten" },
        { label: "Verlopen documenten", value: stats.expiredDocuments, href: "/admin/documenten" },
        { label: "Proefperiodes", value: stats.trials, href: "/admin/billing" },
        { label: "Actieve abonnementen", value: stats.activeSubscriptions, href: "/admin/billing" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Adminoverzicht</h1>
        <p className="text-sm text-muted-foreground">
          Basisstatistieken van het platform.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {tiles.map((tile) => (
          <Link href={tile.href} key={tile.label}>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-4">
                <CardDescription>{tile.label}</CardDescription>
                <CardTitle className="text-3xl">{tile.value}</CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
