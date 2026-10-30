import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Clock,
  MapPin,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateBadge } from "@/components/ui/date-badge";
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

  const applied = actionLabel === "Reactie bekijken";

  return (
    <Card className="group relative transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-raised">
      <div className="flex gap-4 p-4 sm:p-5">
        <DateBadge className="hidden sm:flex" date={job.starts_on} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={isUrgent ? "destructive" : "secondary"}>
              {isUrgent ? <Zap className="h-3 w-3" /> : null}
              {jobTypeLabels[job.job_type]}
            </Badge>
            {job.sport ? <Badge variant="default">{job.sport.name}</Badge> : null}
            <Badge variant="outline">{lessonLabel}</Badge>
            {match?.match_score != null ? (
              <Badge variant="accent">Match {Math.round(match.match_score)}%</Badge>
            ) : null}
          </div>
          <h3 className="mt-2 text-[15px] font-semibold leading-snug">
            <Link
              className="after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/40 group-hover:text-primary"
              href={href}
            >
              {job.title}
            </Link>
          </h3>
          <div className="mt-2 grid gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground sm:grid-cols-2">
            <span className="inline-flex items-center gap-1.5 sm:hidden">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDate(job.starts_on)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span className="tabular-nums">
                {formatTime(job.start_time)}–{formatTime(job.end_time)}
              </span>
              <span className="text-muted-foreground/70">
                ·{" "}
                {job.segments?.length > 1
                  ? `${job.segments.length} lessen · ${formatDuration(durationMinutes)}`
                  : formatDuration(durationMinutes)}
              </span>
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
            <span className="inline-flex min-w-0 items-center gap-1.5 sm:col-span-2">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {job.organization?.name ?? "Sportschool"} ·{" "}
                {job.location?.name ?? "Vestiging onbekend"}
              </span>
            </span>
          </div>
          {hasWarnings ? (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-warning-soft px-2 py-1 text-xs font-medium text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5" />
              {match?.within_travel_distance === false
                ? "Buiten je ingestelde reisafstand"
                : "Je mist een gevraagd diploma"}
            </p>
          ) : null}
        </div>
        <div className="hidden shrink-0 flex-col items-end justify-between gap-3 text-right sm:flex">
          <p className="text-[15px] font-semibold text-foreground">{describePay(job)}</p>
          {actionHref && actionLabel ? (
            <Link className="relative z-10" href={actionHref}>
              <Button size="sm" variant={applied ? "outline" : "default"}>
                {actionLabel}
              </Button>
            </Link>
          ) : null}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border bg-subtle px-4 py-3 sm:hidden">
        <p className="text-sm font-semibold text-foreground">{describePay(job)}</p>
        {actionHref && actionLabel ? (
          <Link className="relative z-10" href={actionHref}>
            <Button size="sm" variant={applied ? "outline" : "default"}>
              {actionLabel}
            </Button>
          </Link>
        ) : null}
      </div>
    </Card>
  );
}
