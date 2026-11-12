import "server-only";
import { listScheduledLessons } from "./lessons";
import { mergeLessonEvents } from "./merge-lessons";
import { sportMatchAgendaProvider } from "./sportmatch-provider";
import type { AgendaEvent, AgendaProvider, AgendaQueryContext } from "./types";
import { deriveLessonState } from "@/lib/jobs/workflow";

export const lessonAgendaProvider: AgendaProvider = {
  id: "organization-lessons",
  async listEvents(context: AgendaQueryContext): Promise<AgendaEvent[]> {
    if (context.role !== "organization" || !context.organizationId) return [];
    const lessons = await listScheduledLessons(
      context.organizationId,
      context.locationId,
    );
    return lessons.map((lesson) => ({
      id: `lesson-${lesson.id}`,
      lessonId: lesson.id,
      jobId: lesson.replacement?.job_id ?? null,
      jobStatus: lesson.replacement?.job.status ?? null,
      title: lesson.title,
      date: lesson.starts_on,
      startTime: lesson.start_time,
      endTime: lesson.end_time,
      state: lesson.cancelled
        ? "cancelled"
        : lesson.replacement
          ? deriveLessonState(lesson.replacement.job.status, undefined)
          : lesson.needs_substitute
            ? "replacement_needed"
            : "scheduled",
      sportName: `${lesson.sport.name} · ${lesson.lesson_type}`,
      payLabel: "",
      locationId: lesson.location_id,
      locationName: lesson.location.name,
      organizationName: "",
      instructorName: lesson.instructor_label || "Nog niet toegewezen",
      detailHref: `/agenda/lessen/${lesson.id}`,
      sourceLabel:
        lesson.source.provider === "synthetic"
          ? "Voorbeeldrooster"
          : "Lesrooster",
      scheduleChanged: Boolean(
        lesson.replacement &&
          lesson.replacement.lesson_revision !== lesson.revision,
      ),
    }));
  },
};

export const agendaProvider: AgendaProvider = {
  id: "sportmatch-and-lessons",
  async listEvents(context) {
    const [jobs, lessons] = await Promise.all([
      sportMatchAgendaProvider.listEvents(context),
      lessonAgendaProvider.listEvents(context),
    ]);
    return mergeLessonEvents(jobs, lessons);
  },
};
