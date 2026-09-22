import { Check, Clock3, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgendaEventState } from "@/lib/agenda/types";

const labels: Record<AgendaEventState, string> = {
  searching: "Nog iemand zoeken",
  action_required: "Reactie ontvangen",
  planned: "Wacht op bevestiging",
  confirmed: "Bevestigd",
  completed: "Afgerond",
  cancelled: "Geannuleerd",
};

const toneClasses: Record<AgendaEventState, string> = {
  searching:
    "border-red-200 bg-red-50 text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400",
  action_required:
    "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-400",
  planned:
    "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-400",
  confirmed:
    "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-400",
  completed:
    "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-400",
  cancelled:
    "border-border bg-muted text-muted-foreground",
};

function StatusIcon({ state }: { state: AgendaEventState }) {
  if (state === "searching" || state === "cancelled") {
    return <X className="h-4 w-4" strokeWidth={2.5} />;
  }
  if (state === "action_required" || state === "planned") {
    return <Clock3 className="h-4 w-4" strokeWidth={2.5} />;
  }
  return <Check className="h-4 w-4" strokeWidth={2.5} />;
}

export function JobStatusIndicator({
  state,
  showLabel = true,
  className,
}: {
  state: AgendaEventState;
  showLabel?: boolean;
  className?: string;
}) {
  const label = labels[state];

  return (
    <span
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center gap-2",
        showLabel && "text-xs font-medium",
        className,
      )}
      title={label}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
          toneClasses[state],
        )}
      >
        <StatusIcon state={state} />
      </span>
      {showLabel ? <span>{label}</span> : null}
    </span>
  );
}
