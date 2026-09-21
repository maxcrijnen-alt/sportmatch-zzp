export const BUSINESS_TIME_ZONE = "Europe/Amsterdam";

interface LocalDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function partsInAmsterdam(instant: Date): LocalDateTimeParts {
  const parts = new Map(
    formatter
      .formatToParts(instant)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: parts.get("year") ?? 0,
    month: parts.get("month") ?? 0,
    day: parts.get("day") ?? 0,
    hour: parts.get("hour") ?? 0,
    minute: parts.get("minute") ?? 0,
    second: parts.get("second") ?? 0,
  };
}

function sameParts(left: LocalDateTimeParts, right: LocalDateTimeParts) {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute &&
    left.second === right.second
  );
}

function offsetAt(instantMs: number) {
  const local = partsInAmsterdam(new Date(instantMs));
  return (
    Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    ) - instantMs
  );
}

/**
 * Interpreteert een database-datum en -tijd als Nederlandse lokale tijd.
 * Geeft null terug voor niet-bestaande kloktijden tijdens de DST-sprong.
 * Bij een dubbele wintertijd kiest dit, net als Temporal "compatible", de
 * eerste geldige instantie.
 */
export function amsterdamDateTimeToInstant(
  date: string,
  time: string,
): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(time);
  if (!dateMatch || !timeMatch) return null;

  const target: LocalDateTimeParts = {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
    second: Number(timeMatch[3] ?? 0),
  };
  const wallClockAsUtc = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
    target.second,
  );

  const probeDistance = 12 * 60 * 60 * 1000;
  const offsets = new Set([
    offsetAt(wallClockAsUtc - probeDistance),
    offsetAt(wallClockAsUtc),
    offsetAt(wallClockAsUtc + probeDistance),
  ]);
  const candidates = [...offsets]
    .map((offset) => wallClockAsUtc - offset)
    .filter((instantMs) => sameParts(partsInAmsterdam(new Date(instantMs)), target))
    .sort((left, right) => left - right);

  return candidates.length > 0 ? new Date(candidates[0]) : null;
}

export function dateInAmsterdam(instant: Date): string {
  const parts = partsInAmsterdam(instant);
  return [parts.year, parts.month, parts.day]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, "0"))
    .join("-");
}

