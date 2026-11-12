import type { AgendaEventState } from "./types";

const calendarStatuses: Record<
  AgendaEventState,
  "CONFIRMED" | "TENTATIVE" | "CANCELLED"
> = {
  scheduled: "CONFIRMED",
  replacement_needed: "TENTATIVE",
  searching: "TENTATIVE",
  action_required: "TENTATIVE",
  planned: "TENTATIVE",
  partially_confirmed: "TENTATIVE",
  confirmed: "CONFIRMED",
  completed: "CONFIRMED",
  closed: "CANCELLED",
  cancelled: "CANCELLED",
};

/** ICS has no CLOSED state; closed searches must never become confirmed events. */
export function calendarStatusForState(state: AgendaEventState) {
  return calendarStatuses[state];
}
