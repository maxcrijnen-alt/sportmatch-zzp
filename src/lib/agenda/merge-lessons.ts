import type { AgendaEvent } from "./types";

/** A linked search appears once, with current roster information and the
 * existing workflow state. Other jobs and block/recurring events are preserved. */
export function mergeLessonEvents(jobs: AgendaEvent[], lessons: AgendaEvent[]) {
  const linked = new Set(lessons.map((lesson) => lesson.jobId).filter(Boolean));
  const byJobId = new Map(jobs.map((job) => [job.jobId, job]));
  return [
    ...jobs.filter((job) => !linked.has(job.jobId)),
    ...lessons.map((lesson) => {
      const job = lesson.jobId ? byJobId.get(lesson.jobId) : undefined;
      if (!job) return lesson;
      return {
        ...lesson,
        jobStatus: job.jobStatus,
        state:
          lesson.state === "cancelled" ? ("cancelled" as const) : job.state,
        instructorName: job.instructorName || lesson.instructorName,
        rosterInstructorName: lesson.instructorName,
        payLabel: job.payLabel,
      };
    }),
  ].sort((a, b) =>
    `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`),
  );
}

export function groupAgendaEvents(events: AgendaEvent[]) {
  const groups: AgendaEvent[][] = [];
  for (const event of events) {
    const previous = groups[groups.length - 1];
    if (event.jobId && previous?.[0].jobId === event.jobId)
      previous.push(event);
    else groups.push([event]);
  }
  return groups;
}
