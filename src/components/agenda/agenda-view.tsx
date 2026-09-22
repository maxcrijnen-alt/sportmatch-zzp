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
  Clock3,
  Download,
  MapPin,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { JobStatusIndicator } from "@/components/jobs/job-status-indicator";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AgendaEvent } from "@/lib/agenda/types";
import type { UserRole } from "@/types/database";

type AgendaViewMode = "list" | "month" | "week" | "day";

const viewLabels: Record<AgendaViewMode, string> = {
  list: "Lijst",
  month: "Maand",
  week: "Week",
  day: "Dag",
};

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
  return (
    <Link
      className={cn(
        "block rounded-md border border-border bg-card transition-colors hover:border-primary/40 hover:bg-primary/5",
        compact ? "p-2" : "p-4",
        event.state === "cancelled" && "opacity-70",
        highlighted && "border-primary ring-2 ring-primary/25",
      )}
      href={event.detailHref}
    >
      <div className="flex items-start gap-2">
        {compact ? (
          <JobStatusIndicator showLabel={false} state={event.state} />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p
                className={cn(
                  "font-medium",
                  compact ? "truncate text-xs" : "text-sm",
                  event.state === "cancelled" && "line-through",
                )}
              >
                {event.title}
              </p>
              <p
                className={cn(
                  "text-muted-foreground",
                  compact ? "text-[0.65rem]" : "mt-1 text-xs",
                )}
              >
                {event.startTime.slice(0, 5)}–{event.endTime.slice(0, 5)}
              </p>
            </div>
            {!compact ? <JobStatusIndicator state={event.state} /> : null}
          </div>
        </div>
      </div>
      {!compact ? (
        <div className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> {event.locationName}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <UserRound className="h-3.5 w-3.5" />
            {role === "organization"
              ? event.instructorName
              : event.organizationName}
          </span>
          <span className="sm:col-span-2">{event.sportName}</span>
          <span className="font-medium text-foreground sm:col-span-2">
            {event.payLabel}
          </span>
        </div>
      ) : null}
    </Link>
  );
}

function EmptyDay() {
  return (
    <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
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

  const periodLabel =
    view === "day"
      ? format(cursor, "EEEE d MMMM yyyy", { locale: nl })
      : view === "week"
        ? `${format(weekDays[0], "d MMM", { locale: nl })} – ${format(weekDays[6], "d MMM yyyy", { locale: nl })}`
        : format(cursor, "MMMM yyyy", { locale: nl });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <Button
            aria-label="Vorige periode"
            onClick={() => move(-1)}
            size="icon"
            variant="outline"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button onClick={() => setCursor(new Date())} variant="outline">
            Vandaag
          </Button>
          <Button
            aria-label="Volgende periode"
            onClick={() => move(1)}
            size="icon"
            variant="outline"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <p className="ml-1 min-w-0 capitalize text-sm font-semibold sm:text-base">
            {periodLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            aria-label="Agendaweergave"
            className="flex rounded-md border border-border p-1"
            role="group"
          >
            {(Object.keys(viewLabels) as AgendaViewMode[]).map((mode) => (
              <button
                aria-pressed={view === mode}
                className={cn(
                  "rounded px-2.5 py-1.5 text-xs font-medium transition-colors sm:text-sm",
                  view === mode
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
            <Button variant="outline">
              <Download className="h-4 w-4" /> Exporteer .ics
            </Button>
          </a>
        </div>
      </div>

      {view === "list" ? (
        <div className="space-y-3">
          {listEvents.length > 0 ? (
            listEvents.map((event) => (
              <div className="grid gap-2 sm:grid-cols-[10rem_1fr]" key={event.id}>
                <div className="pt-2">
                  <p className="text-sm font-semibold capitalize">
                    {format(parseISO(event.date), "EEEE", { locale: nl })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(parseISO(event.date), "d MMMM", { locale: nl })}
                  </p>
                </div>
                <EventCard
                  event={event}
                  highlighted={event.jobId === highlightedJobId}
                  role={role}
                />
              </div>
            ))
          ) : (
            <EmptyDay />
          )}
        </div>
      ) : null}

      {view === "month" ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <div className="grid min-w-[52rem] grid-cols-7 border-b border-border bg-muted/50">
            {["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"].map((day) => (
              <div className="p-2 text-center text-xs font-medium" key={day}>
                {day}
              </div>
            ))}
          </div>
          <div className="grid min-w-[52rem] grid-cols-7">
            {monthDays.map((day) => {
              const dayEvents = eventsForDay(day);
              return (
                <div
                  className={cn(
                    "min-h-32 border-b border-r border-border p-2 last:border-r-0",
                    !isSameMonth(day, cursor) && "bg-muted/30 text-muted-foreground",
                  )}
                  key={day.toISOString()}
                >
                  <button
                    className="mb-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium hover:bg-muted"
                    onClick={() => {
                      setCursor(day);
                      setView("day");
                    }}
                    type="button"
                  >
                    {format(day, "d")}
                  </button>
                  <div className="space-y-1">
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
                        className="text-xs font-medium text-primary hover:underline"
                        onClick={() => {
                          setCursor(day);
                          setView("day");
                        }}
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
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <div className="grid min-w-[52rem] grid-cols-7">
            {weekDays.map((day) => (
              <div className="min-h-72 border-r border-border p-2 last:border-r-0" key={day.toISOString()}>
                <button
                  className="mb-3 w-full rounded-md p-2 text-center hover:bg-muted"
                  onClick={() => {
                    setCursor(day);
                    setView("day");
                  }}
                  type="button"
                >
                  <span className="block text-xs font-medium capitalize text-muted-foreground">
                    {format(day, "EEE", { locale: nl })}
                  </span>
                  <span className="text-lg font-semibold">{format(day, "d")}</span>
                </button>
                <div className="space-y-1.5">
                  {eventsForDay(day).map((event) => (
                    <EventCard
                      compact
                      event={event}
                      highlighted={event.jobId === highlightedJobId}
                      key={event.id}
                      role={role}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {view === "day" ? (
        <Card>
          <CardContent className="space-y-3 pt-5">
            {eventsForDay(cursor).length > 0 ? (
              eventsForDay(cursor).map((event) => (
                <div className="grid gap-2 sm:grid-cols-[7rem_1fr]" key={event.id}>
                  <p className="flex items-center gap-1.5 pt-3 text-sm font-medium">
                    <Clock3 className="h-4 w-4 text-muted-foreground" />
                    {event.startTime.slice(0, 5)}
                  </p>
                  <EventCard
                    event={event}
                    highlighted={event.jobId === highlightedJobId}
                    role={role}
                  />
                </div>
              ))
            ) : (
              <EmptyDay />
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5" />
          "Nog iemand zoeken" betekent dat de plek nog openstaat. "Reactie ontvangen"
          vraagt om actie van de sportschool. "Wacht op bevestiging" betekent dat een
          kandidaat al is gekozen en de instructeur nog definitief moet bevestigen.
        </span>
      </div>
    </div>
  );
}
