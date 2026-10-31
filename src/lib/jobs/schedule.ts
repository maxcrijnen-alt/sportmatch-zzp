import {
  amsterdamDateTimeToInstant,
  dateInAmsterdam,
} from "@/lib/datetime/amsterdam";
import type { JobWorkflowInput } from "@/lib/jobs/workflow";

export interface RecurringSchedule {
  starts_on: string;
  recurrence?: {
    interval_weeks: number;
    ends_on: string | null;
    occurrence_count: number | null;
  } | null;
}

/** Calendar arithmetic on date-only values; deliberately independent of DST. */
export function addCalendarDays(date: string, days: number): string {
  const cursor = new Date(`${date}T12:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() + days);
  return cursor.toISOString().slice(0, 10);
}

export function occurrenceDates(job: RecurringSchedule): string[] {
  if (!job.recurrence) return [job.starts_on];
  const count = Math.min(job.recurrence.occurrence_count ?? 104, 104);
  const intervalDays = Math.max(1, job.recurrence.interval_weeks) * 7;
  const dates: string[] = [];
  let date = job.starts_on;
  while (
    dates.length < count &&
    (!job.recurrence.ends_on || date <= job.recurrence.ends_on)
  ) {
    dates.push(date);
    date = addCalendarDays(date, intervalDays);
  }
  return dates;
}

interface UrgencyJob extends RecurringSchedule, JobWorkflowInput {
  start_time: string;
  end_time: string;
  segments: readonly { id: string; start_time: string; end_time: string }[];
}

/** Today through seven calendar days ahead (inclusive), in Amsterdam.
 * Ended lessons are excluded, ongoing lessons remain relevant. Return the first
 * uncovered lesson only, so each job is counted once in the dashboard. */
export function nextUrgentLesson(job: UrgencyJob, now: Date) {
  if (
    job.status === "cancelled" ||
    job.status === "completed" ||
    job.status === "closed"
  )
    return null;
  const start = dateInAmsterdam(now);
  const end = addCalendarDays(start, 7);
  if (job.confirmations.some((item) => item.confirmed_at && !item.cancelled_at))
    return null;
  const confirmedIds = new Set(
    job.segmentConfirmations
      .filter((item) => item.confirmed_at && !item.cancelled_at)
      .map((item) => item.segment_id),
  );
  const lessons =
    job.segments.length > 0
      ? job.segments.filter((item) => !confirmedIds.has(item.id))
      : [
          {
            id: job.starts_on,
            start_time: job.start_time,
            end_time: job.end_time,
          },
        ];
  for (const date of occurrenceDates(job)) {
    if (date < start || date > end) continue;
    for (const lesson of [...lessons].sort((a, b) =>
      a.start_time.localeCompare(b.start_time),
    )) {
      const endsAt = amsterdamDateTimeToInstant(date, lesson.end_time);
      if (endsAt && endsAt > now) return { date, startTime: lesson.start_time };
    }
  }
  return null;
}
