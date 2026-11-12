import { expect, test } from "@playwright/test";
import {
  lessonInputSchema,
  lessonBatchSchema,
  syntheticLessons,
} from "@/lib/agenda/lesson-contract";
import {
  groupAgendaEvents,
  mergeLessonEvents,
} from "@/lib/agenda/merge-lessons";
import { calendarStatusForState } from "@/lib/agenda/status";
import type { AgendaEvent } from "@/lib/agenda/types";

const sportId = "00000000-0000-4000-8000-000000000001";
const input = {
  externalId: "weekly/2027-03-28",
  revision: 0,
  title: "Circuittraining",
  sportId,
  lessonType: "Circuit",
  date: "2027-03-28",
  startTime: "09:00",
  endTime: "10:00",
  instructor: "Trainer A",
  needsSubstitute: false,
  cancelled: false,
};
const event: AgendaEvent = {
  id: "lesson-a",
  lessonId: "a",
  jobId: null,
  jobStatus: null,
  title: "Circuit",
  date: "2027-03-28",
  startTime: "09:00",
  endTime: "10:00",
  state: "scheduled",
  sportName: "Fitness",
  payLabel: "",
  locationId: "location",
  locationName: "Centrum",
  organizationName: "",
  instructorName: "Trainer A",
  detailHref: "/agenda/lessen/a",
};

for (const [label, patch] of [
  ["onbekende persoonsgegevens", { email: "member@example.test" }],
  ["niet-bestaande zomertijd", { startTime: "02:30" }],
  ["ongeldige datum", { date: "2027-02-30" }],
  ["eindtijd voor begintijd", { endTime: "08:00" }],
  ["ongeldige kloktijd", { endTime: "25:00" }],
  ["ontbrekende identiteit", { externalId: "" }],
] as const) {
  test(`roostercontract weigert ${label}`, () => {
    expect(lessonInputSchema.safeParse({ ...input, ...patch }).success).toBe(
      false,
    );
  });
}

test("dubbele bronidentiteiten en onbegrensde batches worden geweigerd", () => {
  expect(lessonBatchSchema.safeParse([input, input]).success).toBe(false);
  expect(
    lessonBatchSchema.safeParse(
      Array.from({ length: 105 }, (_, n) => ({
        ...input,
        externalId: String(n),
      })),
    ).success,
  ).toBe(false);
});

test("herhalende voorbeeldlessen behouden lokale tijden en IDs over zomertijd", () => {
  const first = syntheticLessons("2027-03-21", sportId);
  const repeated = syntheticLessons("2027-03-21", sportId);
  expect(repeated).toEqual(first);
  expect(first).toHaveLength(12);
  expect(new Set(first.map((lesson) => lesson.externalId)).size).toBe(12);
  const circuit = first.filter((lesson) =>
    lesson.externalId.startsWith("fitness/"),
  );
  expect(circuit.map((lesson) => lesson.date)).toEqual([
    "2027-03-21",
    "2027-03-28",
    "2027-04-04",
    "2027-04-11",
  ]);
  expect(circuit.every((lesson) => lesson.startTime === "09:00")).toBe(true);
  expect(
    lessonInputSchema.safeParse({
      ...input,
      date: "2027-10-31",
      startTime: "02:30",
      endTime: "03:30",
    }).success,
  ).toBe(true);
});

test("gewone lessen worden nooit als één lessenblok gegroepeerd", () => {
  expect(
    groupAgendaEvents([event, { ...event, id: "b", lessonId: "b" }]),
  ).toHaveLength(2);
  expect(
    groupAgendaEvents([
      { ...event, jobId: "job" },
      { ...event, id: "b", jobId: "job" },
    ]),
  ).toHaveLength(1);
});

test("gekoppelde opdracht verschijnt eenmaal en behoudt de actuele workflow", () => {
  const job = {
    ...event,
    id: "job-event",
    lessonId: undefined,
    jobId: "job",
    state: "planned" as const,
    instructorName: "Invaller",
    payLabel: "€ 45",
  };
  const lesson = {
    ...event,
    jobId: "job",
    title: "Gewijzigde les",
    scheduleChanged: true,
  };
  const merged = mergeLessonEvents(
    [job, { ...job, id: "other", jobId: "other" }],
    [lesson],
  );
  expect(merged).toHaveLength(2);
  expect(merged.find((item) => item.lessonId === "a")).toMatchObject({
    title: "Gewijzigde les",
    state: "planned",
    instructorName: "Invaller",
    scheduleChanged: true,
    payLabel: "€ 45",
  });
  expect(
    mergeLessonEvents([job], [{ ...lesson, state: "cancelled" }])[0].state,
  ).toBe("cancelled");
});

test("ICS onderscheidt ingepland van onvervulde invalbehoefte", () => {
  expect(calendarStatusForState("scheduled")).toBe("CONFIRMED");
  expect(calendarStatusForState("replacement_needed")).toBe("TENTATIVE");
  expect(calendarStatusForState("cancelled")).toBe("CANCELLED");
});
