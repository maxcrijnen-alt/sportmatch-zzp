import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionProfile } from "@/lib/auth/session";
import {
  applicationStatusLabels,
  formatDate,
  formatTime,
  jobStatusLabels,
  jobTypeLabels,
} from "@/lib/labels";
import {
  respondInvitationAction,
  withdrawApplicationAction,
} from "@/lib/jobs/actions";
import { createClient } from "@/lib/supabase/server";
import type {
  Job,
  JobApplication,
  JobConfirmation,
  JobInvitation,
} from "@/types/database";

export const metadata: Metadata = {
  title: "Mijn reacties",
};

interface JobSummary
  extends Pick<
    Job,
    "id" | "title" | "starts_on" | "start_time" | "end_time" | "job_type" | "status"
  > {
  location: { city: { name: string } | null } | null;
}

const JOB_SUMMARY_SELECT = `
  id, title, starts_on, start_time, end_time, job_type, status,
  location:organization_locations (city:cities (name))
`;

export default async function MijnReactiesPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile || !supabase) {
    redirect("/login");
  }

  const [applicationsResult, invitationsResult, confirmationsResult] =
    await Promise.all([
      supabase
        .from("job_applications")
        .select(`*, job:jobs (${JOB_SUMMARY_SELECT})`)
        .eq("instructor_id", profile.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("job_invitations")
        .select(`*, job:jobs (${JOB_SUMMARY_SELECT})`)
        .eq("instructor_id", profile.id)
        .eq("status", "pending"),
      supabase
        .from("job_confirmations")
        .select(`*, job:jobs (${JOB_SUMMARY_SELECT})`)
        .eq("instructor_id", profile.id)
        .not("confirmed_at", "is", null),
    ]);

  const applications =
    (applicationsResult.data as unknown as (JobApplication & {
      job: JobSummary | null;
    })[]) ?? [];
  const invitations =
    (invitationsResult.data as unknown as (JobInvitation & {
      job: JobSummary | null;
    })[]) ?? [];
  const confirmations =
    (confirmationsResult.data as unknown as (JobConfirmation & {
      job: JobSummary | null;
    })[]) ?? [];

  const JobLine = ({ job }: { job: JobSummary | null }) =>
    job ? (
      <div className="text-sm text-muted-foreground">
        {formatDate(job.starts_on)} · {formatTime(job.start_time)}–
        {formatTime(job.end_time)} · {job.location?.city?.name ?? ""}
      </div>
    ) : null;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mijn reacties</h1>
        <p className="text-sm text-muted-foreground">
          Je reacties, uitnodigingen en bevestigde opdrachten op één plek.
        </p>
      </div>

      {invitations.length > 0 ? (
        <Card className="border-primary/40">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Openstaande uitnodigingen</CardTitle>
            <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              {invitations.length}
            </span>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {invitations.map((invitation) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-3 first:border-t-0 first:pt-0"
                key={invitation.id}
              >
                <div>
                  <Link
                    className="font-medium text-primary hover:underline"
                    href={`/opdrachten/${invitation.job_id}`}
                  >
                    {invitation.job?.title}
                  </Link>
                  <JobLine job={invitation.job} />
                </div>
                <div className="flex gap-2">
                  <form
                    action={respondInvitationAction.bind(null, invitation.id, true)}
                  >
                    <Button size="sm" type="submit">
                      Accepteren
                    </Button>
                  </form>
                  <form
                    action={respondInvitationAction.bind(null, invitation.id, false)}
                  >
                    <Button size="sm" type="submit" variant="outline">
                      Afslaan
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {confirmations.length > 0 ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Bevestigde opdrachten</CardTitle>
            <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              {confirmations.length}
            </span>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {confirmations.map((confirmation) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-3 first:border-t-0 first:pt-0"
                key={confirmation.id}
              >
                <div>
                  <Link
                    className="font-medium text-primary hover:underline"
                    href={`/opdrachten/${confirmation.job_id}`}
                  >
                    {confirmation.job?.title}
                  </Link>
                  <JobLine job={confirmation.job} />
                </div>
                {confirmation.job ? (
                  <Badge
                    variant={
                      confirmation.job.status === "confirmed"
                        ? "success"
                        : confirmation.job.status === "cancelled"
                          ? "destructive"
                          : "muted"
                    }
                  >
                    {jobStatusLabels[confirmation.job.status]}
                  </Badge>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Reacties</CardTitle>
          <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            {applications.length}
          </span>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {applications.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium">Je hebt nog niet gereageerd</p>
                <p className="mt-1 max-w-md text-sm leading-5 text-muted-foreground">
                  Open passende opdrachten en reageer wanneer datum, locatie,
                  vergoeding en verwachtingen goed aansluiten.
                </p>
              </div>
              <Link href="/opdrachten">
                <Button variant="outline">Opdrachten bekijken</Button>
              </Link>
            </div>
          ) : (
            applications.map((application) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-3 first:border-t-0 first:pt-0"
                key={application.id}
              >
                <div>
                  <Link
                    className="font-medium text-primary hover:underline"
                    href={`/opdrachten/${application.job_id}`}
                  >
                    {application.job?.title}
                  </Link>
                  <JobLine job={application.job} />
                  {application.job ? (
                    <p className="text-xs text-muted-foreground">
                      {jobTypeLabels[application.job.job_type]}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      application.status === "accepted"
                        ? "success"
                        : application.status === "rejected"
                          ? "destructive"
                          : application.status === "withdrawn"
                            ? "muted"
                            : "secondary"
                    }
                  >
                    {applicationStatusLabels[application.status]}
                  </Badge>
                  {application.status === "pending" ? (
                    <form
                      action={withdrawApplicationAction.bind(null, application.id)}
                    >
                      <Button size="sm" type="submit" variant="ghost">
                        Intrekken
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
