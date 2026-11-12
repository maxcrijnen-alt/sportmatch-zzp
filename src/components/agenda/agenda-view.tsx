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
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  Layers,
  MapPin,
  TriangleAlert,
  UserRound,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { JobStatusIndicator } from "@/components/jobs/job-status-indicator";
import { buttonVariants } from "@/components/ui/button";
import { dateInAmsterdam } from "@/lib/datetime/amsterdam";
import { groupAgendaEvents } from "@/lib/agenda/merge-lessons";
import { cn } from "@/lib/utils";
import type { AgendaEvent, AgendaEventState } from "@/lib/agenda/types";
import type { UserRole } from "@/types/database";

type AgendaViewMode = "list" | "month" | "week" | "day";
type AgendaRole = Extract<UserRole, "instructor" | "organization">;

const viewLabels: Record<AgendaViewMode, string> = {
  list: "Lijst",
  month: "Maand",
  week: "Week",
  day: "Dag",
};

const viewOrder: AgendaViewMode[] = ["day", "week", "month", "list"];

const legend: { state: AgendaEventState; label: string; lessonsOnly?: boolean }[] = [
  { state: "scheduled", label: "Ingeplande les", lessonsOnly: true },
  { state: "replacement_needed", label: "Inval nodig, nog geen opdracht", lessonsOnly: true },
  { state: "searching", label: "Nog niemand" },
  { state: "action_required", label: "Reacties" },
  { state: "planned", label: "Bevestiging loopt" },
  { state: "confirmed", label: "Bevestigd" },
  { state: "closed", label: "Gesloten" },
];

/** Korte, zichtbare statustekst op kaarten. De volledige status blijft
 * beschikbaar voor schermlezers via de statusindicator. */
const shortStateLabels: Record<AgendaEventState, string> = {
  scheduled: "Ingepland",
  replacement_needed: "Inval nodig",
  searching: "Nog niemand",
  action_required: "Reacties",
  planned: "Wacht op bevestiging",
  partially_confirmed: "Deels bevestigd",
  confirmed: "Bevestigd",
  completed: "Afgerond",
  closed: "Gesloten",
  cancelled: "Geannuleerd",
};

/* Linkerrand per status: in één oogopslag zien waar actie nodig is. */
const accentClasses: Record<AgendaEventState, string> = {
  scheduled: "border-l-border-strong",
  replacement_needed: "border-l-status-pending bg-warning-soft/60",
  searching: "border-l-status-searching bg-destructive-soft/50",
  action_required: "border-l-status-pending",
  planned: "border-l-status-pending",
  partially_confirmed: "border-l-status-pending",
  confirmed: "border-l-status-confirmed",
  completed: "border-l-status-confirmed/40",
  closed: "border-l-border-strong",
  cancelled: "border-l-border-strong",
};

const stateTextClasses: Record<AgendaEventState, string> = {
  scheduled: "text-muted-foreground",
  replacement_needed: "text-status-pending",
  searching: "text-status-searching",
  action_required: "text-status-pending",
  planned: "text-status-pending",
  partially_confirmed: "text-status-pending",
  confirmed: "text-status-confirmed",
  completed: "text-muted-foreground",
  closed: "text-muted-foreground",
  cancelled: "text-muted-foreground",
};

/* Overzichtsfilters voor sportscholen. Ze gebruiken uitsluitend de bestaande
 * statuswaarden: een gewone, ingeplande les telt nooit als open opdracht. */
type FocusKey = "lessons" | "replacement" | "open" | "unconfirmed" | "confirmed";

const focusFilters: {
  key: FocusKey;
  label: string;
  hint: string;
  tone: string;
  match: (event: AgendaEvent) => boolean;
}[] = [
  {
    key: "lessons",
    label: "Lessen",
    hint: "In het rooster",
    tone: "text-foreground",
    match: (event) => Boolean(event.lessonId) && event.state !== "cancelled",
  },
  {
    key: "replacement",
    label: "Inval nodig",
    hint: "Nog geen opdracht",
    tone: "text-status-pending",
    match: (event) => event.state === "replacement_needed",
  },
  {
    key: "open",
    label: "Open opdrachten",
    hint: "Nog geen instructeur",
    tone: "text-status-searching",
    match: (event) =>
      event.state === "searching" || event.state === "action_required",
  },
  {
    key: "unconfirmed",
    label: "Bevestiging ontbreekt",
    hint: "Wacht op instructeur",
    tone: "text-status-pending",
    match: (event) =>
      event.state === "planned" || event.state === "partially_confirmed",
  },
  {
    key: "confirmed",
    label: "Bevestigd",
    hint: "Rond",
    tone: "text-status-confirmed",
    match: (event) => event.state === "confirmed",
  },
];

const time = (value: string) => value.slice(0, 5);
const UNASSIGNED_LABELS = new Set(["Nog niet toegewezen", "Nog geen instructeur"]);

function eventKind(event: AgendaEvent): "lesson" | "replacement" | "job" {
  if (event.lessonId) return event.jobId ? "replacement" : "lesson";
  return "job";
}

function KindTag({ event }: { event: AgendaEvent }) {
  const kind = eventKind(event);
  if (kind === "lesson") return null;
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1 text-[10px] font-semibold uppercase leading-4 tracking-wide",
        kind === "replacement"
          ? "bg-warning-soft text-amber-800"
          : "bg-muted text-muted-foreground",
      )}
    >
      {kind === "replacement" ? "Inval" : "Opdracht"}
    </span>
  );
}

function PersonLine({ event, role }: { event: AgendaEvent; role: AgendaRole }) {
  const name = role === "organization" ? event.instructorName : event.organizationName;
  const missing = role === "organization" && UNASSIGNED_LABELS.has(name);
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1",
        missing ? "font-medium text-status-pending" : "text-muted-foreground",
      )}
    >
      <UserRound className="h-3 w-3 shrink-0" />
      <span className="truncate">{name}</span>
    </span>
  );
}

function EventCard({
  event,
  compact = false,
  role,
  highlighted = false,
}: {
  event: AgendaEvent;
  compact?: boolean;
  role: AgendaRole;
  highlighted?: boolean;
}) {
  const cancelled = event.state === "cancelled";

  if (compact) {
    return (
      <Link
        className={cn(
          "group block rounded-md border border-l-[3px] border-border bg-card px-2 py-1.5 shadow-xs transition-[border-color,box-shadow] hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          accentClasses[event.state],
          cancelled && "opacity-60",
          highlighted && "ring-2 ring-primary/40",
        )}
        href={event.detailHref}
      >
        <span className="block whitespace-nowrap text-[11px] font-semibold tabular-nums text-foreground">
            {time(event.startTime)}–{time(event.endTime)}
          </span>
        <span
          className={cn(
            "mt-0.5 line-clamp-2 block text-xs font-medium leading-4 text-foreground group-hover:text-primary",
            cancelled && "line-through",
          )}
        >
          {event.title}
        </span>
        <span className="mt-1 block text-[11px] leading-4">
          <PersonLine event={event} role={role} />
        </span>
        <span className="mt-1 flex items-center gap-1 text-[11px] font-medium leading-4">
          <JobStatusIndicator showLabel={false} size="xs" state={event.state} />
          <span aria-hidden="true" className={stateTextClasses[event.state]}>
            {shortStateLabels[event.state]}
          </span>
          <span className="ml-auto">
            <KindTag event={event} />
          </span>
        </span>
        {event.scheduleChanged ? (
          <span className="mt-1 flex items-center gap-1 text-[11px] font-medium leading-4 text-status-pending">
            <TriangleAlert className="h-3 w-3 shrink-0" />
            Rooster gewijzigd
          </span>
        ) : null}
      </Link>
    );
  }

  const person = role === "organization" ? event.instructorName : event.organizationName;
  const personMissing = role === "organization" && UNASSIGNED_LABELS.has(person);

  return (
    <Link
      className={cn(
        "group flex items-start gap-3 rounded-lg border border-l-[3px] border-border bg-card p-3 shadow-xs transition-[border-color,box-shadow] hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        accentClasses[event.state],
        cancelled && "opacity-70",
        highlighted && "ring-2 ring-primary/40",
      )}
      href={event.detailHref}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p
            className={cn(
              "flex min-w-0 items-center gap-2 text-sm font-medium leading-5 group-hover:text-primary",
              cancelled && "line-through",
            )}
          >
            <span className="min-w-0">{event.title}</span>
            <KindTag event={event} />
          </p>
          <span className="shrink-0 text-[13px] font-semibold tabular-nums text-foreground">
            {time(event.startTime)}–{time(event.endTime)}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <JobStatusIndicator size="sm" state={event.state} />
          <span
            className={cn(
              "inline-flex items-center gap-1",
              personMissing && "font-medium text-status-pending",
            )}
          >
            <UserRound className="h-3.5 w-3.5" />
            {person}
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" /> {event.locationName}
          </span>
          {event.payLabel ? (
            <span className="font-medium text-foreground">{event.payLabel}</span>
          ) : null}
          {event.scheduleChanged ? (
            <span className="inline-flex items-center gap-1 font-medium text-status-pending">
              <TriangleAlert className="h-3.5 w-3.5" />
              Rooster gewijzigd · controleer opdracht
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground/90">
          <span>{event.sportName}</span>
          {event.rosterInstructorName ? (
            <span>Rooster: {event.rosterInstructorName}</span>
          ) : null}
          {event.sourceLabel ? <span>{event.sourceLabel}</span> : null}
        </div>
      </div>
    </Link>
  );
}

function EventGroup({
  events,
  role,
  isHighlighted,
}: {
  events: AgendaEvent[];
  role: AgendaRole;
  isHighlighted: (event: AgendaEvent) => boolean;
}) {
  if (events.length === 1) {
    return (
      <EventCard
        event={events[0]}
        highlighted={isHighlighted(events[0])}
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
          highlighted={isHighlighted(event)}
          key={event.id}
          role={role}
        />
      ))}
    </div>
  );
}

function EmptyDay({ filtered = false }: { filtered?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-border-strong px-3 py-4 text-sm text-muted-foreground">
      <CalendarDays className="h-4 w-4" />
      {filtered
        ? "Niets gevonden voor dit filter in deze periode."
        : "Geen lessen of opdrachten in deze periode."}
    </div>
  );
}

/** Lessen die inval nodig hebben, met de directe stap naar een invalopdracht. */
function ReplacementQueue({ events }: { events: AgendaEvent[] }) {
  if (events.length === 0) return null;
  return (
    <section
      aria-label="Inval nodig"
      className="overflow-hidden rounded-xl border border-warning/30 bg-card shadow-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-warning/20 bg-warning-soft px-3 py-2 sm:px-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
          <TriangleAlert className="h-4 w-4 text-status-pending" />
          Inval nodig in deze periode
          <span className="rounded-md bg-card px-1.5 text-xs tabular-nums text-amber-900">
            {events.length}
          </span>
        </h2>
        <p className="flex items-center gap-1 text-[11px] font-medium text-amber-900/80">
          Les
          <ArrowRight className="h-3 w-3" />
          <span className="text-status-pending">Inval nodig</span>
          <ArrowRight className="h-3 w-3" />
          Invalopdracht
          <ArrowRight className="h-3 w-3" />
          Bevestigd
        </p>
      </div>
      <ul className="divide-y divide-border">
        {events.map((event) => {
          const synthetic = event.sourceLabel === "Voorbeeldrooster";
          return (
            <li
              className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4"
              key={event.id}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{event.title}</p>
                <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  <span className="capitalize tabular-nums">
                    {format(parseISO(event.date), "EEE d MMM", { locale: nl })} ·{" "}
                    {time(event.startTime)}–{time(event.endTime)}
                  </span>
                  <span>{event.locationName}</span>
                  <span>Rooster: {event.instructorName}</span>
                </p>
              </div>
              {synthetic ? (
                <span className="shrink-0 text-xs text-muted-foreground">
                  Voorbeeldles · geen echte opdracht
                </span>
              ) : (
                <Link
                  className={cn(buttonVariants({ size: "sm" }), "shrink-0")}
                  href={`/organisatie/opdrachten/nieuw?lesson=${event.lessonId}`}
                >
                  Invalopdracht aanmaken
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function AgendaView({
  events,
  role,
  exportHref,
  highlightedJobId,
  highlightedLessonId,
  defaultView = "list",
  overview = false,
}: {
  events: AgendaEvent[];
  role: AgendaRole;
  exportHref: string;
  highlightedJobId?: string;
  highlightedLessonId?: string;
  defaultView?: AgendaViewMode;
  /** Toon tellingen, filters en de inval-actielijst (sportschoolagenda). */
  overview?: boolean;
}) {
  const [view, setView] = useState<AgendaViewMode>(defaultView);
  const [focus, setFocus] = useState<FocusKey | null>(null);
  const [cursor, setCursor] = useState(() => {
    const highlighted = events.find(
      (event) =>
        (highlightedJobId && event.jobId === highlightedJobId) ||
        (highlightedLessonId && event.lessonId === highlightedLessonId),
    );
    return highlighted
      ? parseISO(highlighted.date)
      : parseISO(dateInAmsterdam(new Date()));
  });
  const today = dateInAmsterdam(new Date());
  const isHighlighted = (event: AgendaEvent) =>
    Boolean(
      (highlightedJobId && event.jobId === highlightedJobId) ||
        (highlightedLessonId && event.lessonId === highlightedLessonId),
    );
  const hasLessons = useMemo(() => events.some((event) => event.lessonId), [events]);
  const showOverview = overview && role === "organization";

  const sortedEvents = useMemo(
    () =>
      [...events].sort((left, right) =>
        `${left.date}T${left.startTime}`.localeCompare(
          `${right.date}T${right.startTime}`,
        ),
      ),
    [events],
  );

  const monthDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
  });
  const weekDays = eachDayOfInterval({
    start: startOfWeek(cursor, { weekStartsOn: 1 }),
    end: endOfWeek(cursor, { weekStartsOn: 1 }),
  });

  const inPeriod = (event: AgendaEvent) => {
    const day = parseISO(event.date);
    if (view === "day") return isSameDay(day, cursor);
    if (view === "week") return day >= weekDays[0] && day <= weekDays[6];
    return isSameMonth(day, cursor);
  };
  const periodEvents = sortedEvents.filter(inPeriod);
  const activeFilter = focusFilters.find((item) => item.key === focus);
  const visibleEvents = activeFilter
    ? sortedEvents.filter(activeFilter.match)
    : sortedEvents;
  const replacementQueue = showOverview
    ? periodEvents.filter((event) => event.state === "replacement_needed")
    : [];

  const eventsForDay = (day: Date) =>
    visibleEvents.filter((event) => isSameDay(parseISO(event.date), day));

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

  const listEvents = visibleEvents.filter((event) =>
    isSameMonth(parseISO(event.date), cursor),
  );
  const listDays = Array.from(new Set(listEvents.map((event) => event.date)));

  const periodLabel =
    view === "day"
      ? format(cursor, "EEEE d MMMM yyyy", { locale: nl })
      : view === "week"
        ? `${format(weekDays[0], "d MMM", { locale: nl })} – ${format(weekDays[6], "d MMM yyyy", { locale: nl })}`
        : format(cursor, "MMMM yyyy", { locale: nl });

  const visibleLegend = legend.filter(
    (item) => !item.lessonsOnly || (role === "organization" && hasLessons),
  );

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
                onClick={() => setCursor(parseISO(dateInAmsterdam(new Date())))}
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

          <div className="flex items-center gap-2">
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
            <a
              className={cn(buttonVariants({ size: "sm", variant: "outline" }), "h-10 sm:h-9")}
              href={exportHref}
              title="Exporteer .ics"
            >
              <Download className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only">Exporteer .ics</span>
            </a>
          </div>
        </div>

        {showOverview ? (
          <div
            aria-label="Overzicht van deze periode"
            className="grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-3 lg:grid-cols-5"
            role="group"
          >
            {focusFilters.map((item) => {
              const count = periodEvents.filter(item.match).length;
              const active = focus === item.key;
              return (
                <button
                  aria-pressed={active}
                  className={cn(
                    "flex flex-col items-start bg-card px-3 py-2 text-left transition-colors hover:bg-subtle focus-visible:relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40",
                    active && "bg-primary-soft hover:bg-primary-soft",
                    item.key === "confirmed" && "max-lg:hidden",
                  )}
                  key={item.key}
                  onClick={() => setFocus(active ? null : item.key)}
                  type="button"
                >
                  <span className="text-xs font-medium text-muted-foreground">
                    {item.label}
                  </span>
                  <span
                    className={cn(
                      "text-xl font-semibold leading-7 tabular-nums",
                      count > 0 ? item.tone : "text-muted-foreground/60",
                    )}
                  >
                    {count}
                  </span>
                  <span className="text-[11px] leading-4 text-muted-foreground">
                    {item.hint}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        <details className="group border-t border-border">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
            <Info className="h-3.5 w-3.5" />
            Legenda
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
          </summary>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 pb-2.5">
            {visibleLegend.map((item) => (
              <span
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                key={item.state}
              >
                <JobStatusIndicator showLabel={false} size="xs" state={item.state} />
                <span aria-hidden="true">{item.label}</span>
              </span>
            ))}
          </div>
        </details>
      </div>

      {activeFilter ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary-soft px-3 py-2 text-[13px]">
          <p className="text-primary-soft-foreground">
            Filter: <span className="font-semibold">{activeFilter.label}</span>
          </p>
          <button
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-primary-soft-foreground hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            onClick={() => setFocus(null)}
            type="button"
          >
            <X className="h-3.5 w-3.5" /> Wis filter
          </button>
        </div>
      ) : null}

      {!activeFilter || activeFilter.key === "replacement" ? (
        <ReplacementQueue events={replacementQueue} />
      ) : null}

      {view === "list" ? (
        listDays.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
            {listDays.map((date) => {
              const day = parseISO(date);
              const dayEvents = listEvents.filter(
                (event) => event.date === date,
              );
              return (
                <div
                  className="grid gap-2 border-b border-border p-3 last:border-b-0 sm:grid-cols-[7.5rem_1fr] sm:gap-3 sm:p-4"
                  key={date}
                >
                  <div className="flex items-baseline gap-2 sm:block">
                    <p
                      className={cn(
                        "text-sm font-semibold capitalize",
                        date === today && "text-primary",
                      )}
                    >
                      {format(day, "EEEE", { locale: nl })}
                    </p>
                    <p className="text-[13px] text-muted-foreground">
                      {format(day, "d MMMM", { locale: nl })}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {groupAgendaEvents(dayEvents).map((group) => (
                      <EventGroup
                        events={group}
                        isHighlighted={isHighlighted}
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
          <EmptyDay filtered={Boolean(activeFilter)} />
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
                      format(day, "yyyy-MM-dd") === today &&
                        "bg-primary text-primary-foreground hover:bg-primary-hover",
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
                      <MonthChip
                        event={event}
                        highlighted={isHighlighted(event)}
                        key={event.id}
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
            const isToday = format(day, "yyyy-MM-dd") === today;
            const attention = dayEvents.filter((event) =>
              ["replacement_needed", "searching", "action_required", "planned", "partially_confirmed"].includes(
                event.state,
              ),
            ).length;
            return (
              <div
                className={cn(
                  "flex gap-3 border-b border-border px-2 py-2 last:border-b-0 md:block md:min-h-56 md:border-b-0 md:border-r md:p-1.5 md:last:border-r-0",
                  isWeekend(day) && "bg-subtle/60",
                  isToday && "bg-primary-soft/40",
                )}
                key={day.toISOString()}
              >
                <button
                  aria-label={`${format(day, "EEEE d MMMM", { locale: nl })}${attention > 0 ? `, ${attention} vragen aandacht` : ""}`}
                  className="flex w-14 shrink-0 flex-col items-center self-start rounded-lg px-1 py-0.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 md:mb-1.5 md:w-full md:flex-row md:justify-center md:gap-1.5 md:py-1"
                  onClick={() => openDay(day)}
                  type="button"
                >
                  <span
                    className={cn(
                      "text-[11px] font-semibold uppercase tracking-wider",
                      isToday ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {format(day, "EEEEEE", { locale: nl })}
                  </span>
                  <span
                    className={cn(
                      "flex h-7 min-w-7 items-center justify-center rounded-md px-1 text-[15px] font-semibold tabular-nums",
                      isToday && "bg-primary text-primary-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {attention > 0 ? (
                    <span
                      aria-hidden="true"
                      className="mt-0.5 rounded-full bg-status-pending px-1.5 text-[10px] font-bold leading-4 text-white md:mt-0"
                    >
                      {attention}
                    </span>
                  ) : null}
                </button>
                <div className="min-w-0 flex-1 space-y-1.5 self-center md:self-auto">
                  {dayEvents.length > 0 ? (
                    dayEvents.map((event) => (
                      <EventCard
                        compact
                        event={event}
                        highlighted={isHighlighted(event)}
                        key={event.id}
                        role={role}
                      />
                    ))
                  ) : (
                    <span
                      aria-hidden="true"
                      className="block text-xs text-muted-foreground/60 md:hidden"
                    >
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
              {groupAgendaEvents(eventsForDay(cursor)).map((group) => (
                <div
                  className="grid gap-2 sm:grid-cols-[4.5rem_1fr]"
                  key={group[0].id}
                >
                  <p className="text-[13px] font-semibold tabular-nums text-muted-foreground sm:pt-3">
                    {time(group[0].startTime)}
                  </p>
                  <EventGroup
                    events={group}
                    isHighlighted={isHighlighted}
                    role={role}
                  />
                </div>
              ))}
            </div>
          ) : (
            <EmptyDay filtered={Boolean(activeFilter)} />
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Eén regel per item in de maandweergave: tijd, status en titel. */
function MonthChip({
  event,
  highlighted,
}: {
  event: AgendaEvent;
  highlighted: boolean;
}) {
  return (
    <Link
      className={cn(
        "group flex items-center gap-1 rounded border border-l-[3px] border-border bg-card px-1 py-0.5 text-[11px] leading-4 shadow-xs hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        accentClasses[event.state],
        event.state === "cancelled" && "opacity-60",
        highlighted && "ring-2 ring-primary/40",
      )}
      href={event.detailHref}
      title={`${time(event.startTime)} ${event.title}`}
    >
      <JobStatusIndicator showLabel={false} size="xs" state={event.state} />
      <span className="shrink-0 font-semibold tabular-nums">{time(event.startTime)}</span>
      <span
        className={cn(
          "truncate group-hover:text-primary",
          event.state === "cancelled" && "line-through",
        )}
      >
        {event.title}
      </span>
    </Link>
  );
}
