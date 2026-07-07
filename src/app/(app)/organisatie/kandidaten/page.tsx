import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSessionProfile } from "@/lib/auth/session";
import { formatDate } from "@/lib/labels";
import { getOrgContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
import type { InstructorPublicStats, JobApplication } from "@/types/database";

export const metadata: Metadata = {
  title: "Kandidaten",
};

interface ApplicationRow extends JobApplication {
  job: { id: string; title: string; starts_on: string } | null;
}

export default async function KandidatenPage() {
  const profile = await getSessionProfile();
  const orgContext = await getOrgContext();
  const supabase = await createClient();

  if (!profile || !supabase) {
    redirect("/login");
  }

  if (!orgContext) {
    redirect("/dashboard");
  }

  const { data } = await supabase
    .from("job_applications")
    .select("*, job:jobs!inner (id, title, starts_on, organization_id)")
    .eq("job.organization_id", orgContext.organization.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const applications = (data as unknown as ApplicationRow[] | null) ?? [];

  const instructorIds = Array.from(
    new Set(applications.map((application) => application.instructor_id)),
  );

  const namesById = new Map<string, { name: string; avatar: string | null }>();
  if (instructorIds.length > 0) {
    const { data: instructorProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", instructorIds);
    for (const row of instructorProfiles ?? []) {
      namesById.set(row.id as string, {
        name: row.full_name as string,
        avatar: row.avatar_url as string | null,
      });
    }
  }

  const statsEntries = await Promise.all(
    instructorIds.map(async (instructorId) => {
      const { data: statsData } = await supabase.rpc("instructor_public_stats", {
        target: instructorId,
      });
      return [
        instructorId,
        ((statsData as InstructorPublicStats[] | null) ?? [])[0] ?? null,
      ] as const;
    }),
  );
  const statsById = new Map(statsEntries);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Kandidaten</h1>
        <p className="text-sm text-muted-foreground">
          Alle openstaande reacties op jullie opdrachten, klaar om te
          vergelijken.
        </p>
      </div>

      {applications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Users className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Geen openstaande reacties. Plaats een opdracht of nodig
              instructeurs uit.
            </p>
            <Link href="/organisatie/opdrachten/nieuw">
              <Button variant="outline">Nieuwe opdracht</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {applications.map((application) => {
            const instructor = namesById.get(application.instructor_id);
            const stats = statsById.get(application.instructor_id);

            return (
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"
                key={application.id}
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    name={instructor?.name ?? "?"}
                    src={instructor?.avatar}
                  />
                  <div>
                    <p className="font-medium">{instructor?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Voor:{" "}
                      <Link
                        className="text-primary hover:underline"
                        href={`/organisatie/opdrachten/${application.job?.id}`}
                      >
                        {application.job?.title}
                      </Link>{" "}
                      · {application.job ? formatDate(application.job.starts_on) : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {stats?.avg_rating != null ? (
                    <Badge variant="accent">★ {stats.avg_rating}</Badge>
                  ) : (
                    <Badge variant="muted">Nieuw</Badge>
                  )}
                  {stats && stats.reliability_score != null ? (
                    <Badge variant="outline">
                      Betrouwbaarheid {stats.reliability_score}%
                    </Badge>
                  ) : null}
                  <Link href={`/organisatie/opdrachten/${application.job?.id}`}>
                    <Button size="sm" variant="outline">
                      Bekijken
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
