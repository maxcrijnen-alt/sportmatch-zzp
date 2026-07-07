-- SportMatch ZZP — 0001: basisschema
-- Tabellen, enums, triggers. RLS en grants staan in 0002; RPC's in 0003.

set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('instructor', 'organization', 'admin');

create type public.instructor_status as enum
  ('zzp', 'employee', 'student', 'job_seeker', 'other');

create type public.org_member_role as enum
  ('owner', 'planner', 'location_manager');

create type public.member_state as enum ('invited', 'active', 'removed');

create type public.organization_type as enum
  ('gym', 'boutique_gym', 'yoga_studio', 'sports_club', 'swimming_pool',
   'municipality', 'hotel', 'holiday_park', 'events_organization');

create type public.document_type as enum
  ('sport_diploma', 'first_aid', 'vog', 'liability_insurance', 'kvk');

create type public.document_status as enum
  ('not_submitted', 'pending', 'approved', 'rejected', 'expired');

create type public.job_type as enum
  ('urgent_substitute', 'one_time', 'recurring', 'temporary', 'permanent');

create type public.job_status as enum
  ('open', 'confirmed', 'completed', 'cancelled', 'closed');

create type public.pay_type as enum ('fixed', 'hourly', 'both');

create type public.application_status as enum
  ('pending', 'accepted', 'rejected', 'withdrawn');

create type public.invitation_status as enum
  ('pending', 'accepted', 'declined', 'expired');

create type public.counteroffer_status as enum
  ('pending', 'accepted', 'rejected', 'withdrawn');

create type public.replacement_status as enum
  ('proposed', 'approved', 'rejected');

create type public.party_side as enum ('instructor', 'organization');

create type public.subscription_status as enum
  ('trial', 'active', 'past_due', 'cancelled', 'expired');

create type public.conversion_fee_status as enum
  ('reported', 'verified', 'invoiced', 'paid', 'disputed');

-- ---------------------------------------------------------------------------
-- Lookup-tabellen
-- ---------------------------------------------------------------------------

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  province text not null,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now()
);

create table public.sports (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.qualifications (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (kind, name)
);

create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profielen en instructeurs
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'instructor',
  full_name text not null default '',
  email text not null default '',
  phone text not null default '',
  avatar_url text,
  city_id uuid references public.cities (id),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.instructor_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  birth_date date,
  work_experience text not null default '',
  years_experience integer not null default 0,
  hourly_rate_cents integer,
  travel_distance_km integer not null default 25,
  kvk_number text not null default '',
  btw_number text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint years_experience_range check (years_experience between 0 and 60),
  constraint travel_distance_range check (travel_distance_km between 1 and 250)
);

create table public.instructor_statuses (
  user_id uuid not null references public.instructor_profiles (user_id) on delete cascade,
  status public.instructor_status not null,
  primary key (user_id, status)
);

create table public.instructor_sports (
  user_id uuid not null references public.instructor_profiles (user_id) on delete cascade,
  sport_id uuid not null references public.sports (id) on delete cascade,
  primary key (user_id, sport_id)
);

create table public.instructor_qualifications (
  user_id uuid not null references public.instructor_profiles (user_id) on delete cascade,
  qualification_id uuid not null references public.qualifications (id) on delete cascade,
  primary key (user_id, qualification_id)
);

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.instructor_profiles (user_id) on delete cascade,
  weekday smallint not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  constraint weekday_range check (weekday between 0 and 6),
  constraint time_order check (start_time < end_time)
);

create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.instructor_profiles (user_id) on delete cascade,
  on_date date not null,
  is_available boolean not null default false,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, on_date)
);

-- ---------------------------------------------------------------------------
-- Documenten
-- ---------------------------------------------------------------------------

create table public.document_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  doc_type public.document_type not null,
  storage_path text not null,
  original_filename text not null default '',
  status public.document_status not null default 'pending',
  expires_at date,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  review_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index document_uploads_user_idx on public.document_uploads (user_id);
create index document_uploads_status_idx on public.document_uploads (status);

-- ---------------------------------------------------------------------------
-- Organisaties
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kvk_number text not null default '',
  org_type public.organization_type not null,
  contact_name text not null default '',
  contact_email text not null default '',
  contact_phone text not null default '',
  billing_email text not null default '',
  billing_reference text not null default '',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  street text not null default '',
  house_number text not null default '',
  postal_code text not null default '',
  city_id uuid not null references public.cities (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index organization_locations_org_idx
  on public.organization_locations (organization_id);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  invited_email text not null default '',
  member_role public.org_member_role not null default 'planner',
  state public.member_state not null default 'active',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index organization_members_user_idx on public.organization_members (user_id);
create index organization_members_email_idx on public.organization_members (invited_email);

-- ---------------------------------------------------------------------------
-- Opdrachten en vacatures
-- ---------------------------------------------------------------------------

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  location_id uuid not null references public.organization_locations (id) on delete cascade,
  created_by uuid not null references public.profiles (id),
  job_type public.job_type not null,
  sport_id uuid not null references public.sports (id),
  title text not null,
  description text not null default '',
  starts_on date not null,
  start_time time not null,
  end_time time not null,
  recurrence_note text not null default '',
  pay_type public.pay_type not null default 'hourly',
  pay_amount_cents integer,
  pay_hourly_rate_cents integer,
  pay_is_negotiable boolean not null default false,
  required_level text not null default '',
  expected_participants integer,
  contact_name text not null default '',
  status public.job_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_time_order check (start_time < end_time)
);

create index jobs_org_idx on public.jobs (organization_id);
create index jobs_status_idx on public.jobs (status);
create index jobs_type_idx on public.jobs (job_type);
create index jobs_sport_idx on public.jobs (sport_id);
create index jobs_date_idx on public.jobs (starts_on);

create table public.job_requirements (
  job_id uuid not null references public.jobs (id) on delete cascade,
  qualification_id uuid not null references public.qualifications (id) on delete cascade,
  primary key (job_id, qualification_id)
);

create table public.job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  instructor_id uuid not null references public.instructor_profiles (user_id) on delete cascade,
  message text not null default '',
  availability_note text not null default '',
  status public.application_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, instructor_id)
);

create index job_applications_instructor_idx
  on public.job_applications (instructor_id);

create table public.job_invitations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  instructor_id uuid not null references public.instructor_profiles (user_id) on delete cascade,
  invited_by uuid not null references public.profiles (id),
  message text not null default '',
  status public.invitation_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, instructor_id)
);

create table public.job_counteroffers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.job_applications (id) on delete cascade,
  created_by uuid not null references public.profiles (id),
  side public.party_side not null,
  pay_type public.pay_type not null,
  amount_cents integer not null,
  message text not null default '',
  status public.counteroffer_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index job_counteroffers_application_idx
  on public.job_counteroffers (application_id);

create table public.job_confirmations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs (id) on delete cascade,
  application_id uuid references public.job_applications (id),
  instructor_id uuid not null references public.instructor_profiles (user_id),
  terms jsonb not null default '{}'::jsonb,
  instructor_agreed_at timestamptz,
  organization_agreed_at timestamptz,
  organization_agreed_by uuid references public.profiles (id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index job_confirmations_instructor_idx
  on public.job_confirmations (instructor_id);

-- ---------------------------------------------------------------------------
-- Vervanging, annulering, no-show
-- ---------------------------------------------------------------------------

create table public.replacements (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  original_instructor_id uuid not null references public.instructor_profiles (user_id),
  proposed_instructor_id uuid not null references public.instructor_profiles (user_id),
  reason text not null default '',
  status public.replacement_status not null default 'proposed',
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index replacements_job_idx on public.replacements (job_id);

create table public.cancellations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  cancelled_by uuid not null references public.profiles (id),
  side public.party_side not null,
  reason text not null default '',
  hours_before_start numeric(8, 2),
  compensation_pct integer not null default 0,
  compensation_note text not null default '',
  admin_adjusted boolean not null default false,
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  constraint compensation_pct_range check (compensation_pct between 0 and 100)
);

create index cancellations_job_idx on public.cancellations (job_id);

create table public.no_show_records (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  instructor_id uuid not null references public.instructor_profiles (user_id),
  reported_by uuid not null references public.profiles (id),
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (job_id, instructor_id)
);

-- ---------------------------------------------------------------------------
-- Chat
-- ---------------------------------------------------------------------------

create table public.chats (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  instructor_id uuid not null references public.instructor_profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  unique (job_id, instructor_id)
);

create index chats_instructor_idx on public.chats (instructor_id);
create index chats_org_idx on public.chats (organization_id);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  sender_id uuid references public.profiles (id),
  body text not null,
  system_event text,
  created_at timestamptz not null default now(),
  constraint body_length check (char_length(body) between 1 and 4000)
);

create index chat_messages_chat_idx on public.chat_messages (chat_id, created_at);

-- ---------------------------------------------------------------------------
-- Notificaties
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null default '',
  href text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id),
  reviewee_id uuid not null references public.profiles (id),
  side public.party_side not null,
  rating integer not null,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  unique (job_id, reviewer_id),
  constraint rating_range check (rating between 1 and 5)
);

create index reviews_reviewee_idx on public.reviews (reviewee_id);

-- ---------------------------------------------------------------------------
-- Abonnementen en billing (mock in MVP)
-- ---------------------------------------------------------------------------

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  -- precies één van beide is gevuld: instructeur of vestiging
  instructor_id uuid unique references public.instructor_profiles (user_id) on delete cascade,
  location_id uuid unique references public.organization_locations (id) on delete cascade,
  status public.subscription_status not null default 'trial',
  price_cents integer not null default 500,
  trial_ends_at timestamptz not null default now() + interval '30 days',
  current_period_end timestamptz,
  grace_until timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_owner check (
    (instructor_id is not null and location_id is null)
    or (instructor_id is null and location_id is not null)
  )
);

create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index billing_events_subscription_idx
  on public.billing_events (subscription_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Conversievergoeding vaste aanname
-- ---------------------------------------------------------------------------

create table public.conversion_fees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  instructor_id uuid not null references public.instructor_profiles (user_id),
  job_id uuid references public.jobs (id),
  reported_by uuid not null references public.profiles (id),
  amount_cents integer not null default 5000,
  status public.conversion_fee_status not null default 'reported',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Adminnotities
-- ---------------------------------------------------------------------------

create table public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles (id),
  target_type text not null,
  target_id uuid not null,
  note text not null,
  created_at timestamptz not null default now()
);

create index admin_notes_target_idx on public.admin_notes (target_type, target_id);

-- ---------------------------------------------------------------------------
-- Triggers: updated_at bijhouden
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'instructor_profiles', 'document_uploads', 'organizations',
    'organization_locations', 'jobs', 'job_applications', 'job_invitations',
    'job_counteroffers', 'job_confirmations', 'subscriptions', 'conversion_fees'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()',
      t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Trigger: profiel aanmaken bij nieuwe auth-gebruiker
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role public.user_role;
begin
  requested_role := coalesce(
    nullif(new.raw_user_meta_data ->> 'role', '')::public.user_role,
    'instructor'
  );

  -- Adminrol kan nooit via zelfregistratie worden geclaimd.
  if requested_role = 'admin' then
    requested_role := 'instructor';
  end if;

  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    requested_role,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Trigger: proefabonnement bij nieuwe vestiging / nieuw instructeursprofiel
-- ---------------------------------------------------------------------------

create or replace function public.create_location_trial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.subscriptions (location_id)
  values (new.id)
  on conflict (location_id) do nothing;

  insert into public.billing_events (subscription_id, event_type, payload)
  select s.id, 'trial_started', jsonb_build_object('location_id', new.id)
  from public.subscriptions s
  where s.location_id = new.id;

  return new;
end;
$$;

create trigger on_location_created
  after insert on public.organization_locations
  for each row execute function public.create_location_trial();

create or replace function public.create_instructor_trial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.subscriptions (instructor_id)
  values (new.user_id)
  on conflict (instructor_id) do nothing;

  insert into public.billing_events (subscription_id, event_type, payload)
  select s.id, 'trial_started', jsonb_build_object('instructor_id', new.user_id)
  from public.subscriptions s
  where s.instructor_id = new.user_id;

  return new;
end;
$$;

create trigger on_instructor_profile_created
  after insert on public.instructor_profiles
  for each row execute function public.create_instructor_trial();

-- ---------------------------------------------------------------------------
-- Trigger: reviews vrijgeven zodra beide partijen hebben beoordeeld
-- ---------------------------------------------------------------------------

create or replace function public.release_reviews_when_complete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*) from public.reviews r
    where r.job_id = new.job_id and r.released_at is null
  ) >= 2 then
    update public.reviews
    set released_at = now()
    where job_id = new.job_id and released_at is null;
  end if;

  return new;
end;
$$;

create trigger on_review_created
  after insert on public.reviews
  for each row execute function public.release_reviews_when_complete();

-- ---------------------------------------------------------------------------
-- Afstandsberekening (haversine, kilometers)
-- ---------------------------------------------------------------------------

create or replace function public.distance_km(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select 6371 * 2 * asin(
    sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2)
      + cos(radians(lat1)) * cos(radians(lat2))
        * power(sin(radians(lng2 - lng1) / 2), 2)
    )
  );
$$;
