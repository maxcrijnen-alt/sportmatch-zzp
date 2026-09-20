import { getSessionProfile } from "@/lib/auth/session";
import { sportMatchAgendaProvider } from "@/lib/agenda/sportmatch-provider";
import type { AgendaEvent } from "@/lib/agenda/types";
import { getOrgContext } from "@/lib/org/context";
import { resolveLocationFilter } from "@/lib/org/location-filter";

function escapeIcs(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll(/\r?\n/g, "\\n");
}

function icsDate(date: string, time: string): string {
  return `${date.replaceAll("-", "")}T${time.slice(0, 8).replaceAll(":", "")}`;
}

function eventStatus(event: AgendaEvent): string {
  if (event.state === "cancelled") {
    return "CANCELLED";
  }
  if (event.state === "planned") {
    return "TENTATIVE";
  }
  return "CONFIRMED";
}

function toIcs(events: AgendaEvent[]): string {
  const generatedAt = new Date()
    .toISOString()
    .replaceAll(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SportMatch//Agenda//NL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:SportMatch Agenda",
    "X-WR-TIMEZONE:Europe/Amsterdam",
  ];

  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@sportmatch.nl`,
      `DTSTAMP:${generatedAt}`,
      `DTSTART;TZID=Europe/Amsterdam:${icsDate(event.date, event.startTime)}`,
      `DTEND;TZID=Europe/Amsterdam:${icsDate(event.date, event.endTime)}`,
      `SUMMARY:${escapeIcs(event.title)}`,
      `LOCATION:${escapeIcs(event.locationName)}`,
      `DESCRIPTION:${escapeIcs(`${event.sportName} · ${event.organizationName} · ${event.payLabel}`)}`,
      `STATUS:${eventStatus(event)}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export async function GET(request: Request) {
  const profile = await getSessionProfile();

  if (!profile) {
    return new Response("Niet ingelogd", { status: 401 });
  }
  if (profile.role === "admin") {
    return new Response("Geen agenda beschikbaar", { status: 403 });
  }

  const orgContext =
    profile.role === "organization" ? await getOrgContext() : null;
  if (profile.role === "organization" && !orgContext) {
    return new Response("Organisatie niet gevonden", { status: 403 });
  }

  const requestedLocation = new URL(request.url).searchParams.get("location");
  const locationId = orgContext
    ? await resolveLocationFilter(
        orgContext.locations,
        requestedLocation ?? undefined,
      )
    : null;
  const events = await sportMatchAgendaProvider.listEvents({
    role: profile.role,
    userId: profile.id,
    organizationId: orgContext?.organization.id,
    locationId,
  });

  return new Response(toIcs(events), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'attachment; filename="sportmatch-agenda.ics"',
      "Content-Type": "text/calendar; charset=utf-8",
    },
  });
}
