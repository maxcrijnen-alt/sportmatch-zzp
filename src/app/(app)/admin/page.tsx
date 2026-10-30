import type { Metadata } from "next";
import { StatTile } from "@/components/ui/stat-tile";
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
        <h1 className="text-2xl font-semibold tracking-tight">Adminoverzicht</h1>
        <p className="text-sm text-muted-foreground">
          Basisstatistieken van het platform.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <StatTile
            href={tile.href}
            key={tile.label}
            label={tile.label}
            value={tile.value}
          />
        ))}
      </div>
    </div>
  );
}
