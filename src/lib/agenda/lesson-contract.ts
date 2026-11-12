import { z } from "zod";
import { amsterdamDateTimeToInstant } from "@/lib/datetime/amsterdam";
import { addCalendarDays, occurrenceDates } from "@/lib/jobs/schedule";
import type { FutureAgendaProviderId } from "./types";

export const lessonInputSchema = z
  .object({
    externalId: z.string().min(1).max(120),
    revision: z.number().int().min(0),
    title: z.string().trim().min(2).max(120),
    sportId: z.string().uuid(),
    lessonType: z.string().trim().min(2).max(100),
    date: z.iso.date(),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    instructor: z.string().trim().max(80),
    needsSubstitute: z.boolean(),
    cancelled: z.boolean(),
  })
  .strict()
  .superRefine((lesson, ctx) => {
    const start = amsterdamDateTimeToInstant(lesson.date, lesson.startTime);
    const end = amsterdamDateTimeToInstant(lesson.date, lesson.endTime);
    if (!start || !end || start >= end || lesson.startTime >= lesson.endTime) {
      ctx.addIssue({
        code: "custom",
        message:
          "Kies geldige Nederlandse lestijden met de eindtijd na de begintijd.",
      });
    }
  });

export type LessonInput = z.infer<typeof lessonInputSchema>;
export const lessonBatchSchema = z
  .array(lessonInputSchema)
  .min(1)
  .max(104)
  .superRefine((lessons, ctx) => {
    if (
      new Set(lessons.map((lesson) => lesson.externalId)).size !==
      lessons.length
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Een les komt meerdere keren in hetzelfde rooster voor.",
      });
    }
  });

/** External adapters must normalize stable occurrence IDs, including moved
 * occurrences and cancellations, before entering this contract. No member data. */
export interface LessonSourceProvider {
  readonly id: "synthetic" | FutureAgendaProviderId;
  loadLessons(anchorDate: string, sportId: string): Promise<LessonInput[]>;
}

/** Fixed four-week fixture; IDs do not depend on a sync time or array position.
 * Deliberately NOT a LogiFit/Gymly/SportBit adapter. No network requests. */
export function syntheticLessons(
  anchorDate: string,
  sportId: string,
): LessonInput[] {
  const patterns = [
    {
      key: "fitness",
      title: "Voorbeeld · Circuittraining",
      type: "Circuittraining",
      start: "09:00",
      end: "10:00",
      instructor: "Voorbeeldtrainer A",
      offset: 0,
      needs: false,
    },
    {
      key: "strength",
      title: "Voorbeeld · Krachttraining",
      type: "Krachttraining",
      start: "18:00",
      end: "19:00",
      instructor: "",
      offset: 1,
      needs: true,
    },
    {
      key: "mobility",
      title: "Voorbeeld · Mobiliteit",
      type: "Mobiliteit",
      start: "11:00",
      end: "12:00",
      instructor: "Voorbeeldtrainer B",
      offset: 3,
      needs: false,
    },
  ];
  return lessonBatchSchema.parse(
    patterns.flatMap((pattern) =>
      occurrenceDates({
        starts_on: addCalendarDays(anchorDate, pattern.offset),
        recurrence: { interval_weeks: 1, occurrence_count: 4, ends_on: null },
      }).map((date) => ({
        externalId: `${pattern.key}/${date}`,
        revision: 0,
        title: pattern.title,
        sportId,
        lessonType: pattern.type,
        date,
        startTime: pattern.start,
        endTime: pattern.end,
        instructor: pattern.instructor,
        needsSubstitute: pattern.needs,
        cancelled: false,
      })),
    ),
  );
}
