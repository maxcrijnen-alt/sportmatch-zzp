import Link from "next/link";
import { AlertTriangle, CalendarDays, Clock, MapPin, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatDate, formatTime, jobTypeLabels } from "@/lib/labels";
import { describePay, type JobWithRelations } from "@/lib/jobs/queries";
import type { OpenJobMatch } from "@/types/database";

export function JobCard({
  job,
  match,
  href,
}: {
  job: JobWithRelations;
  match?: OpenJobMatch;
  href: string;
}) {
  const isUrgent = job.job_type === "urgent_substitute";
  const hasWarnings =
    match &&
    (match.within_travel_distance === false ||
      match.missing_qualifications.length > 0);

  return (
    <Link className="block" href={href}>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isUrgent ? "destructive" : "secondary"}>
              {isUrgent ? (
                <>
                  <Zap className="h-3 w-3" /> {jobTypeLabels[job.job_type]}
                </>
              ) : (
                jobTypeLabels[job.job_type]
              )}
            </Badge>
            {job.sport ? <Badge variant="muted">{job.sport.name}</Badge> : null}
            {match?.match_score != null ? (
              <Badge variant="accent">Match {Math.round(match.match_score)}%</Badge>
            ) : null}
          </div>
          <h3 className="mt-1 font-semibold leading-snug">{job.title}</h3>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDate(job.starts_on)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {formatTime(job.start_time)}–{formatTime(job.end_time)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {job.location?.city?.name ?? "Onbekend"}
              {match?.distance_km != null ? ` · ${match.distance_km} km` : ""}
            </span>
          </div>
          <p className="font-medium text-foreground">{describePay(job)}</p>
          {hasWarnings ? (
            <p className="inline-flex items-center gap-1.5 text-warning">
              <AlertTriangle className="h-3.5 w-3.5" />
              {match?.within_travel_distance === false
                ? "Buiten je ingestelde reisafstand"
                : "Je mist een gevraagd diploma"}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}
