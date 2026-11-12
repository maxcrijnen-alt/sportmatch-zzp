import { redirect } from "next/navigation";
import { SourceForm } from "@/components/agenda/source-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Page, PageHeader } from "@/components/ui/page";
import { getOrgContext } from "@/lib/org/context";
import { listAgendaSources } from "@/lib/agenda/lessons";
import { externalRosterProviders } from "@/lib/agenda/source-providers";

export default async function SourcesPage() {
  const org = await getOrgContext();
  if (!org) redirect("/agenda");
  const sources = await listAgendaSources(org.organization.id);
  return (
    <Page width="medium">
      <PageHeader
        title="Roosterbronnen"
        back={{ href: "/agenda", label: "Agenda" }}
        description="Beheer per vestiging een afgebakend voorbeeldrooster. Je eigen lessen voeg je rechtstreeks toe in de agenda."
      />
      <Card>
        <CardHeader>
          <CardTitle>Externe systemen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {externalRosterProviders.map((provider) => (
            <div key={provider.id}>
              <p className="font-medium">
                {provider.name} · nog niet gekoppeld
              </p>
              <p className="text-sm text-muted-foreground">{provider.status}</p>
            </div>
          ))}
          <p className="text-sm">
            Livekoppelingen zijn nog niet beschikbaar. Er worden geen
            API-sleutels gevraagd of externe gegevens opgehaald.
          </p>
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">
        Het voorbeeld bevat 12 synthetische lessen, verdeeld over vier weken
        vanaf de eerste synchronisatie. Herhalen maakt geen dubbele lessen.
        Voorbeeldlessen kunnen geen echte invalopdracht publiceren.
      </p>
      {org.locations.map((location) => {
        const source = sources.find(
          (item) =>
            item.location_id === location.id && item.provider === "synthetic",
        );
        return (
          <Card
            role="region"
            aria-label={`Voorbeeldrooster ${location.name}`}
            key={location.id}
          >
            <CardHeader>
              <CardTitle>{location.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">
                Voorbeeldrooster: {source?.enabled ? "zichtbaar" : "verborgen"}{" "}
                · {source?.lesson_count ?? 0} lessen
              </p>
              <p className="text-sm">
                Synchronisatiestatus:{" "}
                {source?.sync_status === "success"
                  ? "Geslaagd"
                  : source?.sync_status === "failed"
                    ? "Mislukt · vorige rooster behouden"
                    : "Nog niet gesynchroniseerd"}
              </p>
              {source?.last_synced_at ? (
                <p className="text-xs text-muted-foreground">
                  Laatste geslaagde synchronisatie:{" "}
                  {new Intl.DateTimeFormat("nl-NL", {
                    timeZone: "Europe/Amsterdam",
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(source.last_synced_at))}
                </p>
              ) : null}
              {org.memberRole === "owner" ? (
                <SourceForm
                  locationId={location.id}
                  version={source?.version ?? 0}
                  enabled={source?.enabled ?? false}
                />
              ) : (
                <p className="text-sm">
                  Alleen een eigenaar beheert deze koppeling.
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </Page>
  );
}
