import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { AgendaView } from "@/components/agenda/agenda-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getSessionProfile } from "@/lib/auth/session";
import { sportMatchAgendaProvider } from "@/lib/agenda/sportmatch-provider";
import { getOrgContext } from "@/lib/org/context";
import { resolveLocationFilter } from "@/lib/org/location-filter";

export const metadata: Metadata = {
  title: "Agenda",
};

interface AgendaPageProps {
  searchParams: Promise<{ location?: string; job?: string }>;
}

export default async function AgendaPage({ searchParams }: AgendaPageProps) {
  const profile = await getSessionProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role === "admin") {
    redirect("/admin");
  }

  const params = await searchParams;
  const orgContext =
    profile.role === "organization" ? await getOrgContext() : null;

  if (profile.role === "organization" && !orgContext) {
    redirect("/dashboard");
  }

  const locationId = orgContext
    ? await resolveLocationFilter(orgContext.locations, params.location)
    : null;

  const events = await sportMatchAgendaProvider.listEvents({
    role: profile.role,
    userId: profile.id,
    organizationId: orgContext?.organization.id,
    locationId,
  });
  const selectedLocation = orgContext?.locations.find(
    (location) => location.id === locationId,
  );
  const exportHref = locationId
    ? `/agenda/export?location=${encodeURIComponent(locationId)}`
    : "/agenda/export";

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Agenda</h1>
        <p className="text-sm text-muted-foreground">
          {profile.role === "organization"
            ? selectedLocation
              ? `Geplande en bevestigde lessen voor ${selectedLocation.name}.`
              : "Geplande en bevestigde lessen voor alle vestigingen."
            : "Al je voorlopige, bevestigde en afgeronde opdrachten in één overzicht."}
        </p>
      </div>

      <Alert>
        <CalendarDays className="h-4 w-4" />
        <AlertTitle>Automatisch bijgewerkt</AlertTitle>
        <AlertDescription>
          De agenda wordt opgebouwd uit afspraken en bevestigingen in
          SportMatch. Een geannuleerde, vervangen of afgeronde opdracht krijgt
          automatisch de actuele status; er wordt geen losse kopie bijgehouden.
        </AlertDescription>
      </Alert>

      <AgendaView
        events={events}
        exportHref={exportHref}
        highlightedJobId={params.job}
        role={profile.role}
      />
    </div>
  );
}
