import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  AgendaEvent,
  AgendaEventState,
  AgendaProvider,
  AgendaQueryContext,
} from "@/lib/agenda/types";
import type { JobStatus, PayType } from "@/types/database";

interface AgendaConfirmationRow {
  id: string;
  instructor_id: string;
  confirmed_at: string | null;
  organization_agreed_at: string | null;
  job: {
    id: string;
    organization_id: string;
    location_id: string;
    title: string;
    custom_lesson_type: string | null;
    starts_on: string;
    start_time: string;
    end_time: string;
    status: JobStatus;
    pay_type: PayType;
    pay_amount_cents: number | null;
    pay_hourly_rate_cents: number | null;
    pay_is_negotiable: boolean;
    sport: { name: string } | null;
    lesson_type: { name: string } | null;
    location: { id: string; name: string } | null;
    organization: { name: string } | null;
    recurrence: {
      interval_weeks: number;
      ends_on: string | null;
      occurrence_count: number | null;
    } | null;
  } | null;
}

interface AgendaSegmentConfirmationRow {
  id: string;
  instructor_id: string;
  confirmed_at: string | null;
  organization_agreed_at: string;
  cancelled_at: string | null;
  segment: {
    id: string;
    position: number;
    start_time: string;
    end_time: string;
    custom_lesson_type: string | null;
    lesson_type: { name: string } | null;
  } | null;
  job: AgendaConfirmationRow["job"];
}

interface AgendaPlanningJobRow {
  id: string;
  organization_id: string;
  location_id: string;
  title: string;
  custom_lesson_type: string | null;
  starts_on: string;
  start_time: string;
  end_time: string;
  status: JobStatus;
  pay_type: PayType;
  pay_amount_cents: number | null;
  pay_hourly_rate_cents: number | null;
  pay_is_negotiable: boolean;
  sport: { name: string } | null;
  lesson_type: { name: string } | null;
  location: { id: string; name: string } | null;
  organization: { name: string } | null;
  recurrence: {
    interval_weeks: number;
    ends_on: string | null;
    occurrence_count: number | null;
  } | null;
  segments: Array<{
    id: string;
    position: number;
    start_time: string;
    end_time: string;
    custom_lesson_type: string | null;
    lesson_type: { name: string } | null;
  }>;
}

interface AgendaApplicationRow {
  id: string;
  job_id: string;
}

interface AgendaApplicationSegmentRow {
  application_id: string;
  segment_id: string;
}

function eventState(
  jobStatus: JobStatus,
  confirmedAt: string | null,
  cancelledAt: string | null = null,
): AgendaEventState {
  if (jobStatus === "cancelled" || cancelledAt) {
    return "cancelled";
  }
  if (jobStatus === "completed") {
    return "completed";
  }
  return confirmedAt ? "confirmed" : "planned";
}

function agendaPayLabel(job: NonNullable<AgendaConfirmationRow["job"]>) {
  const euro = (cents: number) =>
    new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
    }).format(cents / 100);
  const label =
    job.pay_type === "fixed" && job.pay_amount_cents != null
      ? `${euro(job.pay_amount_cents)} vast`
      : job.pay_hourly_rate_cents != null
        ? `${euro(job.pay_hourly_rate_cents)} per uur`
        : job.pay_amount_cents != null
          ? `${euro(job.pay_amount_cents)} vast`
          : "In overleg";
  return job.pay_is_negotiable ? `${label} (onderhandelbaar)` : label;
}

function occurrenceDates(job: NonNullable<AgendaConfirmationRow["job"]>) {
  if (!job.recurrence) return [job.starts_on];

  const count = Math.min(job.recurrence.occurrence_count ?? 104, 104);
  const intervalDays = Math.max(1, job.recurrence.interval_weeks) * 7;
  const end = job.recurrence.ends_on
    ? new Date(`${job.recurrence.ends_on}T12:00:00Z`)
    : null;
  const cursor = new Date(`${job.starts_on}T12:00:00Z`);
  const dates: string[] = [];

  while (dates.length < count && (!end || cursor <= end)) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + intervalDays);
  }

  return dates.length > 0 ? dates : [job.starts_on];
}

class SportMatchAgendaProvider implements AgendaProvider {
  readonly id = "sportmatch";

  async listEvents(context: AgendaQueryContext): Promise<AgendaEvent[]> {
    const supabase = await createClient();

    if (!supabase) {
      return [];
    }

    let jobQuery = supabase
      .from("job_confirmations")
      .select(
        `id, instructor_id, confirmed_at, organization_agreed_at,
        job:jobs!inner (
          id, organization_id, location_id, title, custom_lesson_type,
          starts_on, start_time,
          end_time, status, pay_type, pay_amount_cents,
          pay_hourly_rate_cents, pay_is_negotiable,
          sport:sports (name),
          lesson_type:lesson_types (name),
          location:organization_locations (id, name),
          organization:organizations (name),
          recurrence:job_recurrence_rules (interval_weeks, ends_on, occurrence_count)
        )`,
      );

    if (context.role === "organization" && context.organizationId) {
      jobQuery = jobQuery.eq("job.organization_id", context.organizationId);
      if (context.locationId) {
        jobQuery = jobQuery.eq("job.location_id", context.locationId);
      }
    } else {
      jobQuery = jobQuery.eq("instructor_id", context.userId);
    }

    let segmentQuery = supabase
      .from("job_segment_confirmations")
      .select(
        `id, instructor_id, confirmed_at, organization_agreed_at, cancelled_at,
        segment:job_segments!inner (
          id, position, start_time, end_time, custom_lesson_type,
          lesson_type:lesson_types (name)
        ),
        job:jobs!inner (
          id, organization_id, location_id, title, custom_lesson_type,
          starts_on, start_time,
          end_time, status, pay_type, pay_amount_cents,
          pay_hourly_rate_cents, pay_is_negotiable,
          sport:sports (name),
          lesson_type:lesson_types (name),
          location:organization_locations (id, name),
          organization:organizations (name),
          recurrence:job_recurrence_rules (interval_weeks, ends_on, occurrence_count)
        )`,
      );

    if (context.role === "organization" && context.organizationId) {
      segmentQuery = segmentQuery.eq(
        "job.organization_id",
        context.organizationId,
      );
      if (context.locationId) {
        segmentQuery = segmentQuery.eq("job.location_id", context.locationId);
      }
    } else {
      segmentQuery = segmentQuery.eq("instructor_id", context.userId);
    }

    const [jobResult, segmentResult] = await Promise.all([
      jobQuery,
      segmentQuery,
    ]);

    if (jobResult.error) {
      console.error("Agenda kon niet worden geladen", jobResult.error.message);
    }
    if (segmentResult.error) {
      console.error(
        "Lesonderdelen konden niet in de agenda worden geladen",
        segmentResult.error.message,
      );
    }

    const rows =
      (jobResult.data as unknown as AgendaConfirmationRow[] | null) ?? [];
    const segmentRows =
      (segmentResult.data as unknown as AgendaSegmentConfirmationRow[] | null) ??
      [];

    let planningJobs: AgendaPlanningJobRow[] = [];
    let pendingApplications: AgendaApplicationRow[] = [];
    let applicationSegments: AgendaApplicationSegmentRow[] = [];

    if (
      context.role === "organization" &&
      context.organizationId &&
      context.includeOpenPlanning
    ) {
      let planningQuery = supabase
        .from("jobs")
        .select(
          `id, organization_id, location_id, title, custom_lesson_type,
          starts_on, start_time, end_time, status, pay_type, pay_amount_cents,
          pay_hourly_rate_cents, pay_is_negotiable,
          sport:sports (name),
          lesson_type:lesson_types (name),
          location:organization_locations (id, name),
          organization:organizations (name),
          recurrence:job_recurrence_rules (interval_weeks, ends_on, occurrence_count),
          segments:job_segments (
            id, position, start_time, end_time, custom_lesson_type,
            lesson_type:lesson_types (name)
          )`,
        )
        .eq("organization_id", context.organizationId)
        .eq("status", "open");

      if (context.locationId) {
        planningQuery = planningQuery.eq("location_id", context.locationId);
      }

      const planningResult = await planningQuery;
      if (planningResult.error) {
        console.error(
          "Openstaande opdrachten konden niet in de agenda worden geladen",
          planningResult.error.message,
        );
      } else {
        planningJobs =
          (planningResult.data as unknown as AgendaPlanningJobRow[] | null) ?? [];
      }

      const planningJobIds = planningJobs.map((job) => job.id);
      if (planningJobIds.length > 0) {
        const applicationsResult = await supabase
          .from("job_applications")
          .select("id, job_id")
          .in("job_id", planningJobIds)
          .eq("status", "pending");

        if (applicationsResult.error) {
          console.error(
            "Openstaande reacties konden niet in de agenda worden geladen",
            applicationsResult.error.message,
          );
        } else {
          pendingApplications =
            (applicationsResult.data as AgendaApplicationRow[] | null) ?? [];
        }

        const applicationIds = pendingApplications.map(
          (application) => application.id,
        );
        if (applicationIds.length > 0) {
          const applicationSegmentsResult = await supabase
            .from("job_application_segments")
            .select("application_id, segment_id")
            .in("application_id", applicationIds);

          if (applicationSegmentsResult.error) {
            console.error(
              "Reacties op lesonderdelen konden niet in de agenda worden geladen",
              applicationSegmentsResult.error.message,
            );
          } else {
            applicationSegments =
              (applicationSegmentsResult.data as
                | AgendaApplicationSegmentRow[]
                | null) ?? [];
          }
        }
      }
    }

    const instructorIds = Array.from(
      new Set(
        [...rows, ...segmentRows].map((row) => row.instructor_id),
      ),
    );
    const instructorNames = new Map<string, string>();

    if (instructorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", instructorIds);

      for (const profile of profiles ?? []) {
        instructorNames.set(profile.id as string, profile.full_name as string);
      }
    }

    const wholeJobEvents = rows.flatMap((row): AgendaEvent[] => {
      if (!row.job) {
        return [];
      }
      const job = row.job;

      return occurrenceDates(job).map((date, occurrenceIndex) =>
        ({
          id: `${row.id}-${occurrenceIndex}`,
          jobId: job.id,
          title: `${job.custom_lesson_type ?? job.lesson_type?.name ?? "Les"} · ${job.title}`,
          date,
          startTime: job.start_time,
          endTime: job.end_time,
          state: eventState(job.status, row.confirmed_at),
          jobStatus: job.status,
          sportName: job.sport?.name ?? "Sportles",
          payLabel: agendaPayLabel(job),
          locationId: job.location_id,
          locationName: job.location?.name ?? "Onbekende vestiging",
          organizationName: job.organization?.name ?? "Sportschool",
          instructorName:
            instructorNames.get(row.instructor_id) ?? "Instructeur",
          detailHref:
            context.role === "organization"
              ? `/organisatie/opdrachten/${job.id}`
              : `/opdrachten/${job.id}`,
        }) satisfies AgendaEvent,
      );
    });

    const segmentEvents = segmentRows.flatMap((row): AgendaEvent[] => {
      if (!row.job || !row.segment) {
        return [];
      }
      const job = row.job;
      const segment = row.segment;

      const lessonName =
        segment.custom_lesson_type ??
        segment.lesson_type?.name ??
        `Les ${segment.position}`;

      return occurrenceDates(job).map((date, occurrenceIndex) =>
        ({
          id: `${row.id}-${occurrenceIndex}`,
          jobId: job.id,
          title: `${job.title} · ${lessonName}`,
          date,
          startTime: segment.start_time,
          endTime: segment.end_time,
          state: eventState(job.status, row.confirmed_at, row.cancelled_at),
          jobStatus: job.status,
          sportName: job.sport?.name ?? "Sportles",
          payLabel: agendaPayLabel(job),
          locationId: job.location_id,
          locationName: job.location?.name ?? "Onbekende vestiging",
          organizationName: job.organization?.name ?? "Sportschool",
          instructorName:
            instructorNames.get(row.instructor_id) ?? "Instructeur",
          detailHref:
            context.role === "organization"
              ? `/organisatie/opdrachten/${job.id}`
              : `/opdrachten/${job.id}`,
        }) satisfies AgendaEvent,
      );
    });

    const wholeConfirmationJobIds = new Set(
      rows.flatMap((row) => (row.job ? [row.job.id] : [])),
    );
    const activeSegmentIds = new Set(
      segmentRows.flatMap((row) =>
        row.segment && !row.cancelled_at ? [row.segment.id] : [],
      ),
    );
    const pendingByJob = new Map<string, number>();
    const applicationJob = new Map<string, string>();

    for (const application of pendingApplications) {
      applicationJob.set(application.id, application.job_id);
      pendingByJob.set(
        application.job_id,
        (pendingByJob.get(application.job_id) ?? 0) + 1,
      );
    }

    const pendingBySegment = new Map<string, number>();
    const jobsWithSegmentScopedApplications = new Set<string>();
    for (const selection of applicationSegments) {
      pendingBySegment.set(
        selection.segment_id,
        (pendingBySegment.get(selection.segment_id) ?? 0) + 1,
      );
      const jobId = applicationJob.get(selection.application_id);
      if (jobId) {
        jobsWithSegmentScopedApplications.add(jobId);
      }
    }

    const planningEvents =
      context.role === "organization" && context.includeOpenPlanning
        ? planningJobs.flatMap((job): AgendaEvent[] => {
            const detailHref = `/organisatie/opdrachten/${job.id}`;
            const dates = occurrenceDates(job);
            const segments = [...(job.segments ?? [])].sort(
              (left, right) => left.position - right.position,
            );

            if (segments.length === 0) {
              if (wholeConfirmationJobIds.has(job.id)) {
                return [];
              }

              const pendingCount = pendingByJob.get(job.id) ?? 0;
              const state: AgendaEventState =
                pendingCount > 0 ? "action_required" : "searching";
              const instructorName =
                pendingCount > 0
                  ? `${pendingCount} ${pendingCount === 1 ? "reactie" : "reacties"} te beoordelen`
                  : "Nog geen instructeur";

              return dates.map((date, occurrenceIndex) => ({
                id: `planning-${job.id}-${occurrenceIndex}`,
                jobId: job.id,
                title: `${job.custom_lesson_type ?? job.lesson_type?.name ?? "Les"} · ${job.title}`,
                date,
                startTime: job.start_time,
                endTime: job.end_time,
                state,
                jobStatus: job.status,
                sportName: job.sport?.name ?? "Sportles",
                payLabel: agendaPayLabel(job),
                locationId: job.location_id,
                locationName: job.location?.name ?? "Onbekende vestiging",
                organizationName: job.organization?.name ?? "Sportschool",
                instructorName,
                detailHref,
              }));
            }

            return segments.flatMap((segment): AgendaEvent[] => {
              if (activeSegmentIds.has(segment.id)) {
                return [];
              }

              const segmentScoped = jobsWithSegmentScopedApplications.has(job.id);
              const pendingCount = segmentScoped
                ? pendingBySegment.get(segment.id) ?? 0
                : pendingByJob.get(job.id) ?? 0;
              const state: AgendaEventState =
                pendingCount > 0 ? "action_required" : "searching";
              const instructorName =
                pendingCount > 0
                  ? `${pendingCount} ${pendingCount === 1 ? "reactie" : "reacties"} te beoordelen`
                  : "Nog geen instructeur";
              const lessonName =
                segment.custom_lesson_type ??
                segment.lesson_type?.name ??
                `Les ${segment.position}`;

              return dates.map((date, occurrenceIndex) => ({
                id: `planning-${segment.id}-${occurrenceIndex}`,
                jobId: job.id,
                title: `${job.title} · ${lessonName}`,
                date,
                startTime: segment.start_time,
                endTime: segment.end_time,
                state,
                jobStatus: job.status,
                sportName: job.sport?.name ?? "Sportles",
                payLabel: agendaPayLabel(job),
                locationId: job.location_id,
                locationName: job.location?.name ?? "Onbekende vestiging",
                organizationName: job.organization?.name ?? "Sportschool",
                instructorName,
                detailHref,
              }));
            });
          })
        : [];

    return [...wholeJobEvents, ...segmentEvents, ...planningEvents].sort(
      (left, right) =>
        `${left.date}T${left.startTime}`.localeCompare(
          `${right.date}T${right.startTime}`,
        ),
    );
  }
}

export const sportMatchAgendaProvider = new SportMatchAgendaProvider();
