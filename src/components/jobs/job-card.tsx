import Link from "next/link";
import { AlertTriangle, CalendarDays, Clock, MapPin, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatDate, formatTime, jobTypeLabels } from "@/lib/labels";
import { describePay, type JobWithRelations } from "@/lib/jobs/queries";
import type { OpenJobMatch } from "@/types/database";

function minutesBetween(start: string, end: string) {
  const [startHour, startMinute] = start.slice(0, 5).split(":").map(Number);
  const [endHour, endMinute] = end.slice(0, 5).split(":").map(Number);
  return Math.max(0, endHour * 60 + endMinute - startHour * 60 - startMinute);
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} min`;
  return remainder ? `${hours} u ${remainder} min` : `${hours} u`;
}

export function JobCard({
  job,
  match,
  href,
  actionHref,
  actionLabel,
}: {
  job: JobWithRelations;
  match?: OpenJobMatch;
  href: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  const isUrgent = job.job_type === "urgent_substitute";
  const hasWarnings =
    match &&
    (match.within_travel_distance === false ||
      match.missing_qualifications.length > 0);
  const durationMinutes = job.segments?.length
    ? job.segments.reduce(
        (total, segment) =>
          total + minutesBetween(segment.start_time, segment.end_time),
        0,
      )
    : minutesBetween(job.start_time, job.end_time);
  const lessonLabel =
    job.custom_lesson_type || job.lesson_type?.name || "Lesvorm niet opgegeven";

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <Link className="block" href={href}>
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
            <Badge variant="outline">{lessonLabel}</Badge>
            {match?.match_score != null ? (
              <Badge variant="accent">Match {Math.round(match.match_score)}%</Badge>
            ) : null}
          </div>
          <h3 className="mt-1 font-semibold leading-snug">{job.title}</h3>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
              {match
                ? match.distance_km != null
                  ? ` · ${match.distance_km} km`
                  : " · Afstand onbekend"
                : ""}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {job.segments?.length > 1
                ? `${job.segments.length} lessen · ${formatDuration(durationMinutes)}`
                : formatDuration(durationMinutes)}
            </span>
          </div>
          <p>
            {job.organization?.name ?? "Sportschool"} · {job.location?.name ?? "Vestiging onbekend"}
          </p>
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
      </Link>
      {actionHref && actionLabel ? (
        <div className="flex justify-end border-t border-border bg-muted/20 px-4 py-3">
          <Link href={actionHref}>
            <Button size="sm">{actionLabel}</Button>
          </Link>
        </div>
      ) : null}
    </Card>
  );
}
