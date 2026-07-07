import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSessionProfile } from "@/lib/auth/session";
import { formatDate, formatTime, jobStatusLabels, jobTypeLabels } from "@/lib/labels";
import { getOrgContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
import type { Job, JobStatus } from "@/types/database";

export const metadata: Metadata = {
  title: "Opdrachten beheren",
};

interface JobRow extends Job {
  sport: { name: string } | null;
  location: { name: string } | null;
  applications: { count: number }[];
}

const statusVariant: Record<
  JobStatus,
  "secondary" | "success" | "muted" | "destructive" | "outline"
> = {
  open: "secondary",
  confirmed: "success",
  completed: "muted",
  cancelled: "destructive",
  closed: "outline",
};

export default async function OrganisatieOpdrachtenPage() {
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
    .from("jobs")
    .select(
      `*,
      sport:sports (name),
      location:organization_locations (name),
      applications:job_applications (count)`,
    )
    .eq("organization_id", orgContext.organization.id)
    .order("created_at", { ascending: false });

  const jobs = (data as unknown as JobRow[] | null) ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Opdrachten</h1>
          <p className="text-sm text-muted-foreground">
            Alle opdrachten en vacatures van {orgContext.organization.name}.
          </p>
        </div>
        <Link href="/organisatie/opdrachten/nieuw">
          <Button>
            <Plus className="h-4 w-4" /> Nieuwe opdracht
          </Button>
        </Link>
      </div>

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Nog geen opdrachten geplaatst. Plaats je eerste opdracht en bereik
              direct passende instructeurs.
            </p>
            <Link href="/organisatie/opdrachten/nieuw">
              <Button>Eerste opdracht plaatsen</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Opdracht</TableHead>
                <TableHead>Soort</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Vestiging</TableHead>
                <TableHead>Reacties</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <Link
                      className="font-medium text-primary hover:underline"
                      href={`/organisatie/opdrachten/${job.id}`}
                    >
                      {job.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {job.sport?.name}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm">
                    {jobTypeLabels[job.job_type]}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(job.starts_on)}
                    <p className="text-xs text-muted-foreground">
                      {formatTime(job.start_time)}–{formatTime(job.end_time)}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm">{job.location?.name}</TableCell>
                  <TableCell className="text-sm">
                    {job.applications?.[0]?.count ?? 0}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[job.status]}>
                      {jobStatusLabels[job.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
