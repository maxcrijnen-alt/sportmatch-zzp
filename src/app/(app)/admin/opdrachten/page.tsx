import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminCloseJobAction } from "@/lib/admin/actions";
import { formatDate, jobStatusLabels, jobTypeLabels } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { Job } from "@/types/database";

export const metadata: Metadata = {
  title: "Opdrachten",
};

interface JobRow extends Job {
  organization: { name: string } | null;
}

export default async function AdminOpdrachtenPage() {
  const supabase = await createClient();

  if (!supabase) {
    return null;
  }

  const { data } = await supabase
    .from("jobs")
    .select("*, organization:organizations (name)")
    .order("created_at", { ascending: false })
    .limit(200);

  const jobs = (data as unknown as JobRow[] | null) ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Opdrachten</h1>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titel</TableHead>
              <TableHead>Organisatie</TableHead>
              <TableHead>Soort</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actie</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-medium">{job.title}</TableCell>
                <TableCell>{job.organization?.name}</TableCell>
                <TableCell className="text-sm">
                  {jobTypeLabels[job.job_type]}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(job.starts_on)}
                </TableCell>
                <TableCell>
                  <Badge variant={job.status === "open" ? "secondary" : "muted"}>
                    {jobStatusLabels[job.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {job.status === "open" ? (
                    <form action={adminCloseJobAction.bind(null, job.id)}>
                      <Button size="sm" type="submit" variant="ghost">
                        Sluiten
                      </Button>
                    </form>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
