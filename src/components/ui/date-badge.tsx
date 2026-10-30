import { cn } from "@/lib/utils";

function parts(value: string) {
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("nl-NL", { timeZone: "UTC", ...options })
      .format(date)
      .replace(".", "");
  return {
    weekday: format({ weekday: "short" }),
    day: format({ day: "numeric" }),
    month: format({ month: "short" }),
  };
}

/** Compact kalenderblokje voor een datum (YYYY-MM-DD) in lijsten. */
function DateBadge({
  date,
  className,
  tone = "default",
}: {
  date: string;
  className?: string;
  tone?: "default" | "muted";
}) {
  const { weekday, day, month } = parts(date);

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border text-center leading-none",
        tone === "muted"
          ? "border-border bg-subtle text-muted-foreground"
          : "border-border bg-card text-foreground shadow-xs",
        className,
      )}
    >
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {weekday}
      </span>
      <span className="mt-0.5 text-base font-semibold tabular-nums">{day}</span>
      <span className="text-[10px] font-medium uppercase text-muted-foreground">
        {month}
      </span>
    </span>
  );
}

export { DateBadge };
