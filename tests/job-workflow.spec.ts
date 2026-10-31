import { expect, test } from "@playwright/test";
import {
  deriveJobWorkflow,
  deriveLessonState,
  type JobWorkflowInput,
} from "@/lib/jobs/workflow";
import {
  addCalendarDays,
  nextUrgentLesson,
  occurrenceDates,
} from "@/lib/jobs/schedule";
import { canNegotiateJob } from "@/lib/jobs/negotiation";

const pending = {
  organization_agreed_at: "2026-07-01T10:00:00Z",
  confirmed_at: null,
};
const confirmed = { ...pending, confirmed_at: "2026-07-01T11:00:00Z" };
const empty: JobWorkflowInput = {
  status: "open",
  segments: [],
  confirmations: [],
  segmentConfirmations: [],
  pendingApplicationCount: 0,
};

for (const [label, changes, state] of [
  ["geen reacties", {}, "searching"],
  ["één reactie", { pendingApplicationCount: 1 }, "action_required"],
  ["meerdere reacties", { pendingApplicationCount: 3 }, "action_required"],
  ["kandidaat gekozen", { confirmations: [pending] }, "planned"],
  ["definitief akkoord", { confirmations: [confirmed] }, "confirmed"],
  [
    "afgewezen selectie",
    { confirmations: [], pendingApplicationCount: 0 },
    "searching",
  ],
  [
    "afgerond",
    { status: "completed", confirmations: [confirmed] },
    "completed",
  ],
  [
    "geannuleerd",
    { status: "cancelled", confirmations: [confirmed] },
    "cancelled",
  ],
  [
    "gesloten met oude selectie",
    { status: "closed", confirmations: [pending] },
    "closed",
  ],
] as const) {
  test(`opdrachtstatus: ${label}`, () => {
    expect(deriveJobWorkflow({ ...empty, ...changes }).state).toBe(state);
  });
}

test("één van drie lessen is gedeeltelijk bevestigd; alle drie zijn volledig bevestigd", () => {
  const segments = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const partial = {
    ...empty,
    segments,
    segmentConfirmations: [{ ...confirmed, segment_id: "a" }],
  };
  expect(deriveJobWorkflow(partial)).toMatchObject({
    state: "partially_confirmed",
    fullyCovered: false,
    confirmedCount: 1,
    requiredCount: 3,
  });
  expect(deriveJobWorkflow({ ...partial, status: "confirmed" }).state).toBe(
    "partially_confirmed",
  );
  expect(
    deriveJobWorkflow({
      ...partial,
      segmentConfirmations: segments.map((item) => ({
        ...confirmed,
        segment_id: item.id,
      })),
    }),
  ).toMatchObject({
    state: "confirmed",
    fullyCovered: true,
    confirmedCount: 3,
  });
});

test("segmentselectie wacht op akkoord en een geannuleerde bevestiging dekt geen les", () => {
  expect(
    deriveJobWorkflow({
      ...empty,
      segments: [{ id: "a" }],
      segmentConfirmations: [{ ...pending, segment_id: "a" }],
    }).state,
  ).toBe("planned");
  expect(
    deriveJobWorkflow({
      ...empty,
      segments: [{ id: "a" }],
      segmentConfirmations: [
        { ...confirmed, segment_id: "a", cancelled_at: "2026-07-02T10:00:00Z" },
      ],
    }),
  ).toMatchObject({ state: "searching", fullyCovered: false });
});

test("agenda gebruikt per les dezelfde statusregels als het opdrachtenoverzicht", () => {
  expect(deriveLessonState("open", pending)).toBe(
    deriveJobWorkflow({ ...empty, confirmations: [pending] }).state,
  );
  expect(deriveLessonState("open", confirmed)).toBe("confirmed");
  expect(deriveLessonState("closed", confirmed)).toBe("closed");
  expect(deriveLessonState("open", undefined, 2)).toBe("action_required");
  expect(
    deriveLessonState("open", { ...confirmed, cancelled_at: "2026-07-02" }),
  ).toBe("cancelled");
});

const scheduled = {
  ...empty,
  starts_on: "2026-07-15",
  start_time: "10:00",
  end_time: "11:00",
  segments: [] as { id: string; start_time: string; end_time: string }[],
};
const now = new Date("2026-07-15T07:00:00Z"); // 09:00 in Amsterdam.

for (const [date, urgent] of [
  ["2026-07-14", false],
  ["2026-07-15", true],
  ["2026-07-22", true],
  ["2026-07-23", false],
] as const) {
  test(`urgentiegrens ${date}`, () => {
    expect(
      Boolean(nextUrgentLesson({ ...scheduled, starts_on: date }, now)),
    ).toBe(urgent);
  });
}

test("reacties en uitnodigingen vullen de opdracht nog niet definitief in", () => {
  expect(
    nextUrgentLesson({ ...scheduled, pendingApplicationCount: 2 }, now),
  ).not.toBeNull();
  expect(
    nextUrgentLesson({ ...scheduled, confirmations: [pending] }, now),
  ).not.toBeNull();
  expect(
    nextUrgentLesson({ ...scheduled, confirmations: [confirmed] }, now),
  ).toBeNull();
});

test("eerste datum in het verleden sluit een komende herhaling niet uit", () => {
  const recurring = {
    ...scheduled,
    starts_on: "2026-06-24",
    recurrence: { interval_weeks: 1, ends_on: null, occurrence_count: 5 },
  };
  expect(nextUrgentLesson(recurring, now)).toEqual({
    date: "2026-07-15",
    startTime: "10:00",
  });
  expect(
    nextUrgentLesson(
      {
        ...recurring,
        recurrence: { ...recurring.recurrence, ends_on: "2026-07-14" },
      },
      now,
    ),
  ).toBeNull();
  expect(
    nextUrgentLesson(
      {
        ...recurring,
        recurrence: { ...recurring.recurrence, occurrence_count: 2 },
      },
      now,
    ),
  ).toBeNull();
});

test("een lessenblok telt één keer op de eerstvolgende ongedekte les", () => {
  const block = {
    ...scheduled,
    segments: [
      { id: "a", start_time: "10:00", end_time: "11:00" },
      { id: "b", start_time: "11:00", end_time: "12:00" },
      { id: "c", start_time: "12:00", end_time: "13:00" },
    ],
    segmentConfirmations: [{ ...confirmed, segment_id: "a" }],
  };
  expect(nextUrgentLesson(block, now)).toEqual({
    date: "2026-07-15",
    startTime: "11:00",
  });
  expect(
    nextUrgentLesson(
      {
        ...block,
        segmentConfirmations: block.segments.map((s) => ({
          ...confirmed,
          segment_id: s.id,
        })),
      },
      now,
    ),
  ).toBeNull();
  expect(nextUrgentLesson(block, new Date("2026-07-15T11:00:00Z"))).toBeNull();
});

for (const status of ["cancelled", "closed", "completed"] as const) {
  test(`${status} is geen onvervulde urgente opdracht`, () => {
    expect(nextUrgentLesson({ ...scheduled, status }, now)).toBeNull();
  });
}

test("kalenderdagen en wekelijkse herhalingen blijven gelijk over beide DST-overgangen", () => {
  expect(addCalendarDays("2026-03-28", 7)).toBe("2026-04-04");
  expect(addCalendarDays("2026-10-24", 7)).toBe("2026-10-31");
  expect(
    occurrenceDates({
      starts_on: "2026-03-22",
      recurrence: { interval_weeks: 1, ends_on: null, occurrence_count: 3 },
    }),
  ).toEqual(["2026-03-22", "2026-03-29", "2026-04-05"]);
  expect(
    nextUrgentLesson(
      { ...scheduled, starts_on: "2026-10-31" },
      new Date("2026-10-24T22:30:00Z"),
    ),
  ).not.toBeNull();
});

test("alleen een onderhandelbare, open en nog niet geselecteerde reactie kan onderhandelen", () => {
  const job = { status: "open", pay_is_negotiable: true } as const;
  expect(canNegotiateJob(job, { status: "pending" }, false)).toBe(true);
  expect(
    canNegotiateJob(
      { ...job, pay_is_negotiable: false },
      { status: "pending" },
      false,
    ),
  ).toBe(false);
  expect(canNegotiateJob(job, { status: "pending" }, true)).toBe(false);
  for (const status of ["accepted", "rejected", "withdrawn"] as const) {
    expect(canNegotiateJob(job, { status }, false)).toBe(false);
  }
  for (const status of [
    "closed",
    "completed",
    "cancelled",
    "confirmed",
  ] as const) {
    expect(
      canNegotiateJob({ ...job, status }, { status: "pending" }, false),
    ).toBe(false);
  }
});
