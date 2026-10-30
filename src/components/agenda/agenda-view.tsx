"use client";

import Link from "next/link";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  isWeekend,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { nl } from "date-fns/locale";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Layers,
  MapPin,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { JobStatusIndicator } from "@/components/jobs/job-status-indicator";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AgendaEvent, AgendaEventState } from "@/lib/agenda/types";
import type { UserRole } from "@/types/database";

type AgendaViewMode = "list" | "month" | "week" | "day";

const viewLabels: Record<AgendaViewMode, string> = {
  list: "Lijst",
  month: "Maand",
  week: "Week",
  day: "Dag",
};

const viewOrder: AgendaViewMode[] = ["day", "week", "month", "list"];

const legend: { state: AgendaEventState; label: string }[] = [
  { state: "searching", label: "Nog niemand" },
  { state: "action_required", label: "Reacties" },
  { state: "planned", label: "Bevestiging loopt" },
  { state: "confirmed", label: "Bevestigd" },
];

const time = (value: string) => value.slice(0, 5);

function EventCard({
  event,
  compact = false,
  role,
  highlighted = false,
}: {
  event: AgendaEvent;
  compact?: boolean;
  role: UserRole;
  highlighted?: boolean;
}) {
  const cancelled = event.state === "cancelled";

  if (compact) {
    return (
      <Link
        className={cn(
          "group block rounded-md border border-border bg-card px-1.5 py-1 shadow-xs transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          cancelled && "opacity-60",
          highlighted && "border-primary ring-2 ring-primary/25",
        )}
        href={event.detailHref}
      >
        <span className="flex items-center gap-1.5">
          <JobStatusIndicator showLabel={false} size="xs" state={event.state} />
          <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
            {time(event.startTime)}–{time(event.endTime)}
          </span>
        </span>
        <span
          className={cn(
            "mt-0.5 line-clamp-2 block text-xs font-medium leading-4 text-foreground group-hover:text-primary",
            cancelled && "line-through",
          )}
        >
          {event.title}
        </span>
      </Link>
    );
  }

  return (
    <Link
      className={cn(
        "group flex items-start gap-3 rounded-lg border border-border bg-card p-3 shadow-xs transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        cancelled && "opacity-70",
        highlighted && "border-primary ring-2 ring-primary/25",
      )}
      href={event.detailHref}
    >
      <JobStatusIndicator className="mt-0.5" showLabel={false} state={event.state} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p
            className={cn(
              "min-w-0 text-sm font-medium leading-5 group-hover:text-primary",
              cancelled && "line-through",
            )}
          >
            {event.title}
          </p>
          <span className="shrink-0 text-[13px] font-medium tabular-nums text-muted-foreground">
            {time(event.startTime)}–{time(event.endTime)}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" /> {event.locationName}
          </span>
          <span className="inline-flex items-center gap-1">
            <UserRound className="h-3.5 w-3.5" />
            {role === "organization"
              ? event.instructorName
              : event.organizationName}
          </span>
          <span>{event.sportName}</span>
          <span className="font-medium text-foreground">{event.payLabel}</span>
        </div>
      </div>
    </Link>
  );
}

/** Groepeert opeenvolgende lessen van dezelfde opdracht op één dag. */
function groupByJob(events: AgendaEvent[]) {
  const groups: AgendaEvent[][] = [];
  for (const event of events) {
    const current = groups[groups.length - 1];
    if (current && current[0].jobId === event.jobId) {
      current.push(event);
    } else {
      groups.push([event]);
    }
  }
  return groups;
}

function EventGroup({
  events,
  role,
  highlightedJobId,
}: {
  events: AgendaEvent[];
  role: UserRole;
  highlightedJobId?: string;
}) {
  if (events.length === 1) {
    return (
      <EventCard
        event={events[0]}
        highlighted={events[0].jobId === highlightedJobId}
        role={role}
      />
    );
  }

  return (
    <div className="space-y-1.5 rounded-xl border border-dashed border-border-strong bg-subtle p-1.5">
      <p className="flex items-center gap-1.5 px-1.5 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Layers className="h-3 w-3" />
        Lessenblok · {events.length} lessen
      </p>
      {events.map((event) => (
        <EventCard
          event={event}
          highlighted={event.jobId === highlightedJobId}
          key={event.id}
          role={role}
        />
      ))}
    </div>
  );
}

function EmptyDay() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-border-strong px-3 py-4 text-sm text-muted-foreground">
      <CalendarDays className="h-4 w-4" />
      Geen lessen of opdrachten op deze dag.
    </div>
  );
}

export function AgendaView({
  events,
  role,
  exportHref,
  highlightedJobId,
  defaultView = "list",
}: {
  events: AgendaEvent[];
  role: Extract<UserRole, "instructor" | "organization">;
  exportHref: string;
  highlightedJobId?: string;
  defaultView?: AgendaViewMode;
}) {
  const [view, setView] = useState<AgendaViewMode>(defaultView);
  const [cursor, setCursor] = useState(() => {
    const highlighted = events.find((event) => event.jobId === highlightedJobId);
    return highlighted ? parseISO(highlighted.date) : new Date();
  });

  const sortedEvents = useMemo(
    () =>
      [...events].sort((left, right) =>
        `${left.date}T${left.startTime}`.localeCompare(
          `${right.date}T${right.startTime}`,
        ),
      ),
    [events],
  );

  const eventsForDay = (day: Date) =>
    sortedEvents.filter((event) => isSameDay(parseISO(event.date), day));

  const move = (direction: -1 | 1) => {
    setCursor((current) => {
      if (view === "month" || view === "list") {
        return direction < 0 ? subMonths(current, 1) : addMonths(current, 1);
      }
      if (view === "week") {
        return direction < 0 ? subWeeks(current, 1) : addWeeks(current, 1);
      }
      return direction < 0 ? subDays(current, 1) : addDays(current, 1);
    });
  };

  const openDay = (day: Date) => {
    setCursor(day);
    setView("day");
  };

  const monthDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
  });
  const weekDays = eachDayOfInterval({
    start: startOfWeek(cursor, { weekStartsOn: 1 }),
    end: endOfWeek(cursor, { weekStartsOn: 1 }),
  });
  const listEvents = sortedEvents.filter((event) =>
    isSameMonth(parseISO(event.date), cursor),
  );
  const listDays = Array.from(new Set(listEvents.map((event) => event.date)));

  const periodLabel =
    view === "day"
      ? format(cursor, "EEEE d MMMM yyyy", { locale: nl })
      : view === "week"
        ? `${format(weekDays[0], "d MMM", { locale: nl })} – ${format(weekDays[6], "d MMM yyyy", { locale: nl })}`
        : format(cursor, "MMMM yyyy", { locale: nl });

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card shadow-card">
        <div className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex items-center rounded-lg border border-border bg-card shadow-xs">
              <button
                aria-label="Vorige periode"
                className="flex h-9 w-9 items-center justify-center rounded-l-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                onClick={() => move(-1)}
                type="button"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                className="h-9 border-x border-border px-3 text-[13px] font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                onClick={() => setCursor(new Date())}
                type="button"
              >
                Vandaag
              </button>
              <button
                aria-label="Volgende periode"
                className="flex h-9 w-9 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                onClick={() => move(1)}
                type="button"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <p
              aria-live="polite"
              className="ml-1 min-w-0 truncate text-[15px] font-semibold capitalize tracking-tight sm:text-base"
            >
              {periodLabel}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              aria-label="Agendaweergave"
              className="flex flex-1 rounded-lg border border-border bg-muted/70 p-1 sm:flex-none"
              role="group"
            >
              {viewOrder.map((mode) => (
                <button
                  aria-pressed={view === mode}
                  className={cn(
                    "h-8 flex-1 rounded-md px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:flex-none",
                    view === mode
                      ? "bg-card text-foreground shadow-card ring-1 ring-black/5"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  key={mode}
                  onClick={() => setView(mode)}
                  type="button"
                >
                  {viewLabels[mode]}
                </button>
              ))}
            </div>
            <a href={exportHref}>
              <Button size="sm" variant="outline">
                <Download className="h-4 w-4" /> Exporteer .ics
              </Button>
            </a>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border px-3 py-2">
          {legend.map((item) => (
            <span
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
              key={item.state}
            >
              <JobStatusIndicator showLabel={false} size="xs" state={item.state} />
              <span aria-hidden="true">{item.label}</span>
            </span>
          ))}
        </div>
      </div>

      {view === "list" ? (
        listDays.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
            {listDays.map((date) => {
              const day = parseISO(date);
              const dayEvents = listEvents.filter((event) => event.date === date);
              return (
                <div
                  className="grid gap-3 border-b border-border p-3 last:border-b-0 sm:grid-cols-[7.5rem_1fr] sm:p-4"
                  key={date}
                >
                  <div className="flex items-center gap-3 sm:block">
                    <p
                      className={cn(
                        "text-sm font-semibold capitalize",
                        isToday(day) && "text-primary",
                      )}
                    >
                      {format(day, "EEEE", { locale: nl })}
                    </p>
                    <p className="text-[13px] text-muted-foreground">
                      {format(day, "d MMMM", { locale: nl })}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {groupByJob(dayEvents).map((group) => (
                      <EventGroup
                        events={group}
                        highlightedJobId={highlightedJobId}
                        key={group[0].id}
                        role={role}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyDay />
        )
      ) : null}

      {view === "month" ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <div className="grid grid-cols-7 border-b border-border bg-subtle">
            {["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"].map((day) => (
              <div
                className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                key={day}
              >
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthDays.map((day) => {
              const dayEvents = eventsForDay(day);
              const inMonth = isSameMonth(day, cursor);
              return (
                <div
                  className={cn(
                    "min-h-16 border-b border-r border-border p-1 [&:nth-child(7n)]:border-r-0 md:min-h-28 md:p-1.5",
                    !inMonth && "bg-subtle/80",
                    inMonth && isWeekend(day) && "bg-subtle/50",
                  )}
                  key={day.toISOString()}
                >
                  <button
                    aria-label={format(day, "EEEE d MMMM", { locale: nl })}
                    className={cn(
                      "mb-1 flex h-7 w-7 items-center justify-center rounded-md text-xs font-medium tabular-nums transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                      !inMonth && "text-muted-foreground/70",
                      isToday(day) && "bg-primary text-primary-foreground hover:bg-primary-hover",
                    )}
                    onClick={() => openDay(day)}
                    type="button"
                  >
                    {format(day, "d")}
                  </button>
                  {dayEvents.length > 0 ? (
                    <button
                      aria-hidden="true"
                      className="flex flex-wrap gap-0.5 md:hidden"
                      onClick={() => openDay(day)}
                      tabIndex={-1}
                      type="button"
                    >
                      {dayEvents.slice(0, 4).map((event) => (
                        <JobStatusIndicator
                          key={event.id}
                          showLabel={false}
                          size="xs"
                          state={event.state}
                        />
                      ))}
                    </button>
                  ) : null}
                  <div className="hidden space-y-1 md:block">
                    {dayEvents.slice(0, 3).map((event) => (
                      <EventCard
                        compact
                        event={event}
                        highlighted={event.jobId === highlightedJobId}
                        key={event.id}
                        role={role}
                      />
                    ))}
                    {dayEvents.length > 3 ? (
                      <button
                        className="px-1 text-xs font-medium text-primary hover:underline"
                        onClick={() => openDay(day)}
                        type="button"
                      >
                        +{dayEvents.length - 3} meer
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {view === "week" ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card md:grid md:grid-cols-7">
          {weekDays.map((day) => {
            const dayEvents = eventsForDay(day);
            const today = isToday(day);
            return (
              <div
                className={cn(
                  "flex items-center gap-3 border-b border-border px-2 py-1.5 last:border-b-0 md:block md:min-h-72 md:border-b-0 md:border-r md:p-1.5 md:last:border-r-0",
                  isWeekend(day) && "bg-subtle/60",
                  today && "bg-primary-soft/40",
                )}
                key={day.toISOString()}
              >
                <button
                  className={cn(
                    "flex w-16 shrink-0 items-center gap-1.5 rounded-lg px-1 py-0.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 md:mb-1.5 md:w-full md:flex-col md:justify-center md:gap-0 md:py-1",
                  )}
                  onClick={() => openDay(day)}
                  type="button"
                >
                  <span
                    className={cn(
                      "text-[11px] font-semibold uppercase tracking-wider",
                      today ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {format(day, "EEEEEE", { locale: nl })}
                  </span>
                  <span
                    className={cn(
                      "flex h-7 min-w-7 items-center justify-center rounded-md px-1 text-[15px] font-semibold tabular-nums md:mt-0.5",
                      today && "bg-primary text-primary-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </button>
                <div className="min-w-0 flex-1 space-y-1.5 self-center md:self-auto">
                  {dayEvents.length > 0 ? (
                    dayEvents.map((event) => (
                      <EventCard
                        compact
                        event={event}
                        highlighted={event.jobId === highlightedJobId}
                        key={event.id}
                        role={role}
                      />
                    ))
                  ) : (
                    <span aria-hidden="true" className="block text-xs text-muted-foreground/60 md:hidden">
                      —
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {view === "day" ? (
        <div className="rounded-xl border border-border bg-card p-3 shadow-card sm:p-4">
          {eventsForDay(cursor).length > 0 ? (
            <div className="space-y-2">
              {groupByJob(eventsForDay(cursor)).map((group) => (
                <div className="grid gap-2 sm:grid-cols-[4.5rem_1fr]" key={group[0].id}>
                  <p className="pt-3 text-[13px] font-semibold tabular-nums text-muted-foreground">
                    {time(group[0].startTime)}
                  </p>
                  <EventGroup
                    events={group}
                    highlightedJobId={highlightedJobId}
                    role={role}
                  />
                </div>
              ))}
            </div>
          ) : (
            <EmptyDay />
          )}
        </div>
      ) : null}
    </div>
  );
}
