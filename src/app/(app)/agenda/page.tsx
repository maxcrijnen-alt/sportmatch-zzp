import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Settings2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AgendaView } from "@/components/agenda/agenda-view";
import { Page, PageHeader } from "@/components/ui/page";
import { getSessionProfile } from "@/lib/auth/session";
import { agendaProvider } from "@/lib/agenda/provider";
import { getOrgContext } from "@/lib/org/context";
import { resolveLocationFilter } from "@/lib/org/location-filter";

export const metadata: Metadata = {
  title: "Agenda",
};

interface AgendaPageProps {
  searchParams: Promise<{ location?: string; job?: string; lesson?: string }>;
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

  const events = await agendaProvider.listEvents({
    role: profile.role,
    userId: profile.id,
    organizationId: orgContext?.organization.id,
    locationId,
    includeOpenPlanning: profile.role === "organization",
  });
  const exportHref = locationId
    ? `/agenda/export?location=${encodeURIComponent(locationId)}`
    : "/agenda/export";

  return (
    <Page width="wide">
      <PageHeader
        title="Agenda"
        description={
          orgContext
            ? "Lesrooster en invalopdrachten. Klik op een tegel om te filteren."
            : undefined
        }
        actions={
          orgContext ? (
            <>
              <Link
                className={buttonVariants({ variant: "outline" })}
                href="/agenda/koppelingen"
              >
                <Settings2 className="h-4 w-4" />
                Roosterbronnen
              </Link>
              <Link className={buttonVariants()} href="/agenda/lessen/nieuw">
                <Plus className="h-4 w-4" />
                Les toevoegen
              </Link>
            </>
          ) : undefined
        }
      />

      <AgendaView
        events={events}
        exportHref={exportHref}
        highlightedJobId={params.job}
        highlightedLessonId={params.lesson}
        defaultView={orgContext ? "week" : "list"}
        overview={Boolean(orgContext)}
        role={profile.role}
      />
    </Page>
  );
}
