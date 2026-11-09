import type { AgendaEventState } from "@/lib/agenda/types";
import type { JobStatus } from "@/types/database";

export interface WorkflowConfirmation {
  confirmed_at: string | null;
  organization_agreed_at: string | null;
  cancelled_at?: string | null;
}

export interface WorkflowSegmentConfirmation extends WorkflowConfirmation {
  segment_id: string;
}

export interface JobWorkflowInput {
  status: JobStatus;
  segments: readonly { id: string }[];
  confirmations: readonly WorkflowConfirmation[];
  segmentConfirmations: readonly WorkflowSegmentConfirmation[];
  pendingApplicationCount: number;
}

/** One instructor is required per lesson. Assignments cover the whole series:
 * the current data model has no assignments for individual recurrence dates. */
export function deriveJobWorkflow(input: JobWorkflowInput) {
  const active = input.segmentConfirmations.filter(
    (item) => !item.cancelled_at,
  );
  const whole = input.confirmations.filter((item) => !item.cancelled_at);
  const confirmedSegments = new Set(
    active.filter((item) => item.confirmed_at).map((item) => item.segment_id),
  );
  const wholeConfirmed = whole.some((item) => Boolean(item.confirmed_at));
  const requiredCount = input.segments.length || 1;
  const confirmedCount = wholeConfirmed
    ? requiredCount
    : input.segments.filter((segment) => confirmedSegments.has(segment.id))
        .length;
  const hasPendingConfirmation = [...whole, ...active].some(
    (item) => Boolean(item.organization_agreed_at) && !item.confirmed_at,
  );
  const fullyCovered = confirmedCount === requiredCount;
  let state: AgendaEventState;
  if (
    input.status === "cancelled" ||
    input.status === "completed" ||
    input.status === "closed"
  ) {
    state = input.status;
  } else if (fullyCovered) {
    state = "confirmed";
  } else if (confirmedCount > 0) {
    state = "partially_confirmed";
  } else if (hasPendingConfirmation) {
    state = "planned";
  } else {
    state = input.pendingApplicationCount > 0 ? "action_required" : "searching";
  }
  return {
    state,
    fullyCovered,
    confirmedCount,
    requiredCount,
    hasPendingConfirmation,
  };
}

/** A lesson's status uses the same rules as the overall assignment. */
export function deriveLessonState(
  status: JobStatus,
  confirmation: WorkflowConfirmation | undefined,
  pendingApplicationCount = 0,
): AgendaEventState {
  if (confirmation?.cancelled_at) return "cancelled";
  return deriveJobWorkflow({
    status,
    segments: [],
    confirmations: confirmation ? [confirmation] : [],
    segmentConfirmations: [],
    pendingApplicationCount,
  }).state;
}

/** Legacy whole-block responses still apply when scoped responses also exist. */
export function countLessonApplications(
  jobId: string,
  segmentId: string,
  applications: readonly { id: string; job_id: string }[],
  selections: readonly { application_id: string; segment_id: string }[],
) {
  const segmentIdsByApplication = new Map<string, Set<string>>();
  for (const selection of selections) {
    const ids =
      segmentIdsByApplication.get(selection.application_id) ??
      new Set<string>();
    ids.add(selection.segment_id);
    segmentIdsByApplication.set(selection.application_id, ids);
  }
  return new Set(
    applications
      .filter((application) => {
        const ids = segmentIdsByApplication.get(application.id);
        return application.job_id === jobId && (!ids || ids.has(segmentId));
      })
      .map((application) => application.id),
  ).size;
}
