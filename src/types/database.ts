// Handmatige databasetypes voor de MVP. Bij schemawijzigingen bijwerken,
// of later vervangen door gegenereerde Supabase-types.

export type UserRole = "instructor" | "organization" | "admin";

export type InstructorStatus =
  | "zzp"
  | "employee"
  | "student"
  | "job_seeker"
  | "other";

export type OrgMemberRole = "owner" | "planner" | "location_manager";

export type MemberState = "invited" | "active" | "removed";

export type OrganizationType =
  | "gym"
  | "boutique_gym"
  | "yoga_studio"
  | "sports_club"
  | "swimming_pool"
  | "municipality"
  | "hotel"
  | "holiday_park"
  | "events_organization";

export type DocumentType =
  | "sport_diploma"
  | "first_aid"
  | "vog"
  | "liability_insurance"
  | "kvk";

export type DocumentStatus =
  | "not_submitted"
  | "pending"
  | "approved"
  | "rejected"
  | "expired";

export type JobType =
  | "urgent_substitute"
  | "one_time"
  | "recurring"
  | "temporary"
  | "permanent";

export type JobStatus = "open" | "confirmed" | "completed" | "cancelled" | "closed";

export type PayType = "fixed" | "hourly" | "both";

export type ApplicationStatus = "pending" | "accepted" | "rejected" | "withdrawn";

export type InvitationStatus = "pending" | "accepted" | "declined" | "expired";

export type CounterofferStatus = "pending" | "accepted" | "rejected" | "withdrawn";

export type ReplacementStatus = "proposed" | "approved" | "rejected";

export type PartySide = "instructor" | "organization";

export type SubscriptionStatus =
  | "trial"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";

export type ConversionFeeStatus =
  | "reported"
  | "verified"
  | "invoiced"
  | "paid"
  | "disputed";

export interface City {
  id: string;
  name: string;
  province: string;
  lat: number;
  lng: number;
}

export interface Sport {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

export interface Qualification {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  email: string;
  phone: string;
  avatar_url: string | null;
  city_id: string | null;
  onboarding_completed: boolean;
  created_at: string;
}

export interface InstructorProfile {
  user_id: string;
  birth_date: string | null;
  work_experience: string;
  years_experience: number;
  hourly_rate_cents: number | null;
  travel_distance_km: number;
  kvk_number: string;
  btw_number: string;
}

export interface Organization {
  id: string;
  name: string;
  kvk_number: string;
  org_type: OrganizationType;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  billing_email: string;
  billing_reference: string;
  created_by: string;
}

export interface OrganizationLocation {
  id: string;
  organization_id: string;
  name: string;
  street: string;
  house_number: string;
  postal_code: string;
  city_id: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string | null;
  invited_email: string;
  member_role: OrgMemberRole;
  state: MemberState;
}

export interface Job {
  id: string;
  organization_id: string;
  location_id: string;
  created_by: string;
  job_type: JobType;
  sport_id: string;
  title: string;
  description: string;
  starts_on: string;
  start_time: string;
  end_time: string;
  recurrence_note: string;
  pay_type: PayType;
  pay_amount_cents: number | null;
  pay_hourly_rate_cents: number | null;
  pay_is_negotiable: boolean;
  required_level: string;
  expected_participants: number | null;
  contact_name: string;
  status: JobStatus;
  created_at: string;
}

export interface JobApplication {
  id: string;
  job_id: string;
  instructor_id: string;
  message: string;
  availability_note: string;
  status: ApplicationStatus;
  created_at: string;
}

export interface JobInvitation {
  id: string;
  job_id: string;
  instructor_id: string;
  invited_by: string;
  message: string;
  status: InvitationStatus;
  created_at: string;
}

export interface JobCounteroffer {
  id: string;
  application_id: string;
  created_by: string;
  side: PartySide;
  pay_type: PayType;
  amount_cents: number;
  message: string;
  status: CounterofferStatus;
  created_at: string;
}

export interface JobConfirmation {
  id: string;
  job_id: string;
  application_id: string | null;
  instructor_id: string;
  terms: Record<string, unknown>;
  instructor_agreed_at: string | null;
  organization_agreed_at: string | null;
  confirmed_at: string | null;
}

export interface Replacement {
  id: string;
  job_id: string;
  original_instructor_id: string;
  proposed_instructor_id: string;
  reason: string;
  status: ReplacementStatus;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface Cancellation {
  id: string;
  job_id: string;
  cancelled_by: string;
  side: PartySide;
  reason: string;
  hours_before_start: number | null;
  compensation_pct: number;
  compensation_note: string;
  admin_adjusted: boolean;
  admin_note: string;
  created_at: string;
}

export interface DocumentUpload {
  id: string;
  user_id: string;
  doc_type: DocumentType;
  storage_path: string;
  original_filename: string;
  status: DocumentStatus;
  expires_at: string | null;
  reviewed_at: string | null;
  review_note: string;
  created_at: string;
}

export interface Chat {
  id: string;
  job_id: string;
  organization_id: string;
  instructor_id: string;
  last_message_at: string;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  sender_id: string | null;
  body: string;
  system_event: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  notification_type: string;
  title: string;
  body: string;
  href: string;
  read_at: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  job_id: string;
  reviewer_id: string;
  reviewee_id: string;
  side: PartySide;
  rating: number;
  released_at: string | null;
  created_at: string;
}

export interface Subscription {
  id: string;
  instructor_id: string | null;
  location_id: string | null;
  status: SubscriptionStatus;
  price_cents: number;
  trial_ends_at: string;
  current_period_end: string | null;
  grace_until: string | null;
  cancelled_at: string | null;
}

export interface ConversionFee {
  id: string;
  organization_id: string;
  instructor_id: string;
  job_id: string | null;
  reported_by: string;
  amount_cents: number;
  status: ConversionFeeStatus;
  note: string;
  created_at: string;
}

export interface OpenJobMatch {
  job_id: string;
  distance_km: number | null;
  within_travel_distance: boolean | null;
  sport_match: boolean;
  missing_qualifications: string[];
  match_score: number | null;
}

export interface InstructorPublicStats {
  completed_count: number;
  confirmed_count: number;
  cancellation_count: number;
  no_show_count: number;
  avg_rating: number | null;
  review_count: number;
  reliability_score: number | null;
}
