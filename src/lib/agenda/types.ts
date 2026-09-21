import type { JobStatus, UserRole } from "@/types/database";

export type AgendaEventState =
  | "searching"
  | "action_required"
  | "planned"
  | "confirmed"
  | "completed"
  | "cancelled";

export interface AgendaEvent {
  id: string;
  jobId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  state: AgendaEventState;
  jobStatus: JobStatus;
  sportName: string;
  payLabel: string;
  locationId: string;
  locationName: string;
  organizationName: string;
  instructorName: string;
  detailHref: string;
}

export interface AgendaQueryContext {
  role: Extract<UserRole, "instructor" | "organization">;
  userId: string;
  organizationId?: string;
  locationId?: string | null;
  includeOpenPlanning?: boolean;
}

export interface AgendaProvider {
  readonly id: string;
  listEvents(context: AgendaQueryContext): Promise<AgendaEvent[]>;
}

/**
 * Gereserveerde providernamen voor toekomstige koppelingen. Er zijn bewust
 * geen endpoints of adapters gekoppeld totdat de officiële API-contracten en
 * autorisatiegegevens voor Gymly of SportBit beschikbaar zijn.
 */
export type FutureAgendaProviderId = "gymly" | "sportbit";
