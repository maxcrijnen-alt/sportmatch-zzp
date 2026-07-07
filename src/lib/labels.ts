import type {
  ApplicationStatus,
  DocumentStatus,
  DocumentType,
  InstructorStatus,
  JobStatus,
  JobType,
  OrganizationType,
  OrgMemberRole,
  SubscriptionStatus,
  ConversionFeeStatus,
} from "@/types/database";

export const jobTypeLabels: Record<JobType, string> = {
  urgent_substitute: "Spoed-inval",
  one_time: "Eenmalige opdracht",
  recurring: "Terugkerende opdracht",
  temporary: "Tijdelijke functie",
  permanent: "Vaste vacature",
};

export const jobStatusLabels: Record<JobStatus, string> = {
  open: "Open",
  confirmed: "Bevestigd",
  completed: "Afgerond",
  cancelled: "Geannuleerd",
  closed: "Gesloten",
};

export const organizationTypeLabels: Record<OrganizationType, string> = {
  gym: "Sportschool / fitnesscentrum",
  boutique_gym: "Boutique gym",
  yoga_studio: "Yogastudio",
  sports_club: "Sportvereniging",
  swimming_pool: "Zwembad",
  municipality: "Gemeente / buurtsport",
  hotel: "Hotel",
  holiday_park: "Vakantiepark",
  events_organization: "Evenementenorganisatie",
};

export const instructorStatusLabels: Record<InstructorStatus, string> = {
  zzp: "Zzp'er",
  employee: "Werknemer",
  student: "Student",
  job_seeker: "Werkzoekend",
  other: "Andere sportprofessional",
};

export const orgMemberRoleLabels: Record<OrgMemberRole, string> = {
  owner: "Eigenaar",
  planner: "Planner",
  location_manager: "Vestigingsmanager",
};

export const documentTypeLabels: Record<DocumentType, string> = {
  sport_diploma: "Sportdiploma",
  first_aid: "EHBO / BHV / AED",
  vog: "VOG",
  liability_insurance: "Aansprakelijkheidsverzekering",
  kvk: "KvK-uittreksel",
};

export const documentStatusLabels: Record<DocumentStatus, string> = {
  not_submitted: "Niet ingediend",
  pending: "In afwachting",
  approved: "Goedgekeurd",
  rejected: "Afgekeurd",
  expired: "Verlopen",
};

export const applicationStatusLabels: Record<ApplicationStatus, string> = {
  pending: "In behandeling",
  accepted: "Geaccepteerd",
  rejected: "Afgewezen",
  withdrawn: "Ingetrokken",
};

export const subscriptionStatusLabels: Record<SubscriptionStatus, string> = {
  trial: "Proefperiode",
  active: "Actief",
  past_due: "Betaling mislukt",
  cancelled: "Opgezegd",
  expired: "Verlopen",
};

export const conversionFeeStatusLabels: Record<ConversionFeeStatus, string> = {
  reported: "Gemeld",
  verified: "Gecontroleerd",
  invoiced: "Gefactureerd",
  paid: "Betaald",
  disputed: "Betwist",
};

export function formatEuro(cents: number | null | undefined): string {
  if (cents == null) {
    return "—";
  }
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatTime(value: string): string {
  // tijden komen als "HH:MM:SS" uit Postgres
  return value.slice(0, 5);
}
