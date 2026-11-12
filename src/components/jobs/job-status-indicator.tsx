import { Check, Clock3, Inbox, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgendaEventState } from "@/lib/agenda/types";

const labels: Record<AgendaEventState, string> = {
  scheduled: "Ingeplande les",
  replacement_needed: "Inval nodig · nog geen opdracht",
  searching: "Nog iemand zoeken",
  action_required: "Reactie ontvangen",
  planned: "Wacht op bevestiging",
  confirmed: "Bevestigd",
  partially_confirmed: "Gedeeltelijk bevestigd",
  completed: "Afgerond",
  closed: "Gesloten",
  cancelled: "Geannuleerd",
};

/*
 * Vierkante statusindicator: rood kruis (nog niemand), oranje (reacties of
 * lopende bevestiging), groen vinkje (bevestigd). Afgerond en geannuleerd
 * blijven herkenbaar maar rustiger, omdat ze geen actie meer vragen.
 */
const toneClasses: Record<AgendaEventState, string> = {
  scheduled: "border-border-strong bg-subtle text-muted-foreground",
  replacement_needed: "border-status-pending bg-status-pending text-white",
  searching: "border-status-searching bg-status-searching text-white",
  action_required: "border-status-pending bg-status-pending text-white",
  planned: "border-status-pending bg-status-pending text-white",
  confirmed: "border-status-confirmed bg-status-confirmed text-white",
  partially_confirmed: "border-status-pending bg-status-pending text-white",
  completed: "border-status-confirmed/40 bg-success-soft text-status-confirmed",
  closed: "border-border-strong bg-muted text-muted-foreground",
  cancelled: "border-border-strong bg-muted text-muted-foreground",
};

const labelToneClasses: Record<AgendaEventState, string> = {
  scheduled: "text-muted-foreground",
  replacement_needed: "text-status-pending",
  searching: "text-status-searching",
  action_required: "text-status-pending",
  planned: "text-status-pending",
  confirmed: "text-status-confirmed",
  partially_confirmed: "text-status-pending",
  completed: "text-muted-foreground",
  closed: "text-muted-foreground",
  cancelled: "text-muted-foreground",
};

const sizeClasses = {
  xs: "h-4 w-4 rounded-[4px] [&_svg]:h-2.5 [&_svg]:w-2.5",
  sm: "h-5 w-5 rounded-[5px] [&_svg]:h-3 [&_svg]:w-3",
  md: "h-6 w-6 rounded-md [&_svg]:h-3.5 [&_svg]:w-3.5",
};

function StatusIcon({ state }: { state: AgendaEventState }) {
  if (state === "scheduled") return <Minus strokeWidth={3} />;
  if (state === "replacement_needed") return <Clock3 strokeWidth={2.75} />;
  if (state === "closed") return <Minus strokeWidth={3} />;
  if (state === "searching" || state === "cancelled") {
    return <X strokeWidth={3} />;
  }
  if (state === "action_required") {
    return <Inbox strokeWidth={2.75} />;
  }
  if (state === "planned" || state === "partially_confirmed") {
    return <Clock3 strokeWidth={2.75} />;
  }
  return <Check strokeWidth={3} />;
}

export function JobStatusIndicator({
  state,
  showLabel = true,
  size = "md",
  className,
}: {
  state: AgendaEventState;
  showLabel?: boolean;
  size?: keyof typeof sizeClasses;
  className?: string;
}) {
  const label = labels[state];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-2",
        showLabel && "text-[13px] font-medium",
        className,
      )}
      title={label}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex shrink-0 items-center justify-center border",
          sizeClasses[size],
          toneClasses[state],
        )}
      >
        <StatusIcon state={state} />
      </span>
      <span className={showLabel ? labelToneClasses[state] : "sr-only"}>
        {label}
      </span>
    </span>
  );
}

export { labels as jobStatusIndicatorLabels };
