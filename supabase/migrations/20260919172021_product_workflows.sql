-- SportMatch product workflows
-- Additive migration: demo isolation, structured lessons, reusable jobs,
-- cancellation review, mandatory reviews, VOG gates and incident reporting.

set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- Demo isolation and profile/location fallbacks
-- ---------------------------------------------------------------------------

create table public.demo_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '8 hours'),
  constraint demo_session_expiry_after_creation check (expires_at > created_at)
);

alter table public.profiles
  add column demo_session_id uuid references public.demo_sessions (id) on delete cascade,
  add column custom_city text;

grant select (custom_city) on public.profiles to authenticated;

alter table public.organizations
  add column demo_session_id uuid references public.demo_sessions (id) on delete cascade;

alter table public.jobs
  add column demo_session_id uuid references public.demo_sessions (id) on delete cascade;

create index profiles_demo_session_idx on public.profiles (demo_session_id)
  where demo_session_id is not null;
create index organizations_demo_session_idx on public.organizations (demo_session_id)
  where demo_session_id is not null;
create index jobs_demo_session_idx on public.jobs (demo_session_id)
  where demo_session_id is not null;

-- ---------------------------------------------------------------------------
-- Public partner configuration and structured lesson types
-- ---------------------------------------------------------------------------

create table public.partner_schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  website_url text,
  active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_school_name_not_blank check (btrim(name) <> ''),
  constraint partner_school_website_http check (
    website_url is null or website_url ~ '^https://'
  )
);

create table public.lesson_types (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null references public.sports (id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (sport_id, name),
  constraint lesson_type_name_not_blank check (btrim(name) <> '')
);

create table public.instructor_lesson_types (
  user_id uuid not null references public.instructor_profiles (user_id) on delete cascade,
  lesson_type_id uuid not null references public.lesson_types (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, lesson_type_id)
);

create index instructor_lesson_types_lesson_idx
  on public.instructor_lesson_types (lesson_type_id, user_id);

alter table public.jobs
  add column lesson_type_id uuid references public.lesson_types (id),
  add column custom_lesson_type text,
  add column closed_reason text,
  add column closed_note text not null default '',
  add column closed_at timestamptz,
  add column closed_by uuid references public.profiles (id),
  add column partial_block_allowed boolean not null default false,
  add constraint jobs_custom_lesson_type_not_blank check (
    custom_lesson_type is null or btrim(custom_lesson_type) <> ''
  ),
  add constraint jobs_closed_reason_valid check (
    closed_reason is null or closed_reason in (
      'match_via_sportmatch', 'internal_match', 'lesson_cancelled',
      'no_longer_needed', 'other'
    )
  );

create index jobs_lesson_type_idx on public.jobs (lesson_type_id);

-- Every active sport receives a maintainable starter set. Admins can extend or
-- deactivate these rows without changing application code.
insert into public.lesson_types (sport_id, name, sort_order)
select s.id, preset.name, preset.sort_order
from public.sports s
cross join lateral (
  select * from (values
    ('fitness', 'Fitnessbegeleiding', 10), ('fitness', 'Circuittraining', 20),
    ('fitness', 'Krachttraining', 30),
    ('groepsles', 'Bodypump', 10), ('groepsles', 'HIIT', 20),
    ('groepsles', 'Core training', 30),
    ('yoga', 'Vinyasa yoga', 10), ('yoga', 'Yin yoga', 20),
    ('yoga', 'Hatha yoga', 30),
    ('pilates', 'Mat pilates', 10), ('pilates', 'Reformer pilates', 20),
    ('tennis', 'Tennisles jeugd', 10), ('tennis', 'Tennisles volwassenen', 20),
    ('tennis', 'Tennisclinic', 30),
    ('padel', 'Padelles beginners', 10), ('padel', 'Padelles gevorderden', 20),
    ('padel', 'Padelclinic', 30),
    ('zwemmen', 'Zwem-ABC', 10), ('zwemmen', 'Aquafitness', 20),
    ('zwemmen', 'Toezicht', 30),
    ('personal-training', 'Personal training', 10),
    ('personal-training', 'Duo training', 20),
    ('spinning', 'Spinning', 10), ('spinning', 'Indoor cycling beginners', 20),
    ('bootcamp', 'Bootcamp', 10), ('bootcamp', 'Bedrijfsbootcamp', 20),
    ('kickboksen', 'Kickboksen beginners', 10),
    ('kickboksen', 'Kickboksen gevorderden', 20),
    ('kickboksen', 'Techniektraining', 30),
    ('crossfit', 'CrossFit WOD', 10), ('crossfit', 'CrossFit fundamentals', 20),
    ('dans', 'Streetdance', 10), ('dans', 'Ballet', 20),
    ('dans', 'Hip-hop', 30), ('dans', 'Zumba', 40), ('dans', 'Modern', 50),
    ('voetbal', 'Voetbaltraining jeugd', 10),
    ('voetbal', 'Voetbaltraining senioren', 20), ('voetbal', 'Clinic', 30),
    ('hockey', 'Hockeytraining jeugd', 10),
    ('hockey', 'Hockeytraining senioren', 20), ('hockey', 'Clinic', 30)
  ) as v(sport_slug, name, sort_order)
  where v.sport_slug = s.slug
) preset
on conflict (sport_id, name) do nothing;

insert into public.lesson_types (sport_id, name, sort_order)
select s.id, 'Training', 999
from public.sports s
where s.is_active
  and not exists (
    select 1 from public.lesson_types lt where lt.sport_id = s.id
  )
on conflict (sport_id, name) do nothing;

-- ---------------------------------------------------------------------------
-- Templates, recurrence and contiguous lesson blocks
-- ---------------------------------------------------------------------------

create table public.job_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid not null references public.profiles (id),
  name text not null,
  template_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_template_name_not_blank check (btrim(name) <> ''),
  constraint job_template_data_object check (jsonb_typeof(template_data) = 'object')
);

create index job_templates_org_idx on public.job_templates (organization_id, created_at desc);

create table public.job_recurrence_rules (
  job_id uuid primary key references public.jobs (id) on delete cascade,
  interval_weeks integer not null default 1,
  weekdays smallint[] not null default '{}',
  ends_on date,
  occurrence_count integer,
  created_at timestamptz not null default now(),
  constraint recurrence_interval_range check (interval_weeks between 1 and 52),
  constraint recurrence_count_range check (
    occurrence_count is null or occurrence_count between 2 and 104
  ),
  constraint recurrence_weekdays_range check (
    weekdays <@ array[0,1,2,3,4,5,6]::smallint[]
  )
);

create table public.job_segments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  position integer not null,
  start_time time not null,
  end_time time not null,
  lesson_type_id uuid references public.lesson_types (id),
  custom_lesson_type text,
  level text not null default '',
  created_at timestamptz not null default now(),
  unique (job_id, position),
  constraint job_segment_time_order check (start_time < end_time),
  constraint job_segment_position_positive check (position > 0),
  constraint job_segment_custom_type_not_blank check (
    custom_lesson_type is null or btrim(custom_lesson_type) <> ''
  )
);

create index job_segments_job_time_idx on public.job_segments (job_id, start_time);

create table public.job_application_segments (
  application_id uuid not null references public.job_applications (id) on delete cascade,
  segment_id uuid not null references public.job_segments (id) on delete cascade,
  primary key (application_id, segment_id)
);

create table public.job_segment_confirmations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  segment_id uuid not null unique references public.job_segments (id) on delete cascade,
  application_id uuid not null references public.job_applications (id) on delete cascade,
  instructor_id uuid not null references public.instructor_profiles (user_id),
  terms jsonb not null default '{}'::jsonb,
  organization_agreed_at timestamptz not null default now(),
  organization_agreed_by uuid not null references public.profiles (id),
  instructor_agreed_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (segment_id, instructor_id)
);

create index segment_confirmations_instructor_idx
  on public.job_segment_confirmations (instructor_id, confirmed_at);

-- ---------------------------------------------------------------------------
-- Cancellation review, richer reviews and private complaints
-- ---------------------------------------------------------------------------

alter table public.cancellations
  drop constraint if exists compensation_pct_range;

alter table public.cancellations
  alter column compensation_pct set default 150,
  add column compensation_amount_cents integer,
  add column force_majeure_claimed boolean not null default false,
  add column force_majeure_status text not null default 'not_requested',
  add column evidence_path text,
  add column reviewed_by uuid references public.profiles (id),
  add column reviewed_at timestamptz,
  add column instructor_id uuid references public.instructor_profiles (user_id),
  add column segment_ids uuid[] not null default '{}',
  add constraint compensation_pct_range check (compensation_pct between 0 and 150),
  add constraint compensation_amount_nonnegative check (
    compensation_amount_cents is null or compensation_amount_cents >= 0
  ),
  add constraint force_majeure_status_valid check (
    force_majeure_status in ('not_requested', 'pending_review', 'approved', 'rejected')
  );

alter table public.job_segment_confirmations
  add column cancelled_at timestamptz,
  add column cancelled_by uuid references public.profiles (id),
  drop constraint if exists job_segment_confirmations_segment_id_key,
  drop constraint if exists job_segment_confirmations_segment_id_instructor_id_key;

create unique index job_segment_confirmations_active_segment_unique
  on public.job_segment_confirmations (segment_id)
  where cancelled_at is null;

alter table public.reviews
  add column comment text not null default '';

-- A lesson block can have more than one instructor. One organization reviewer
-- must therefore be able to review every confirmed instructor for the job.
alter table public.reviews
  drop constraint if exists reviews_job_id_reviewer_id_key,
  add constraint reviews_job_reviewer_reviewee_unique
    unique (job_id, reviewer_id, reviewee_id);

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  reported_by uuid not null references public.profiles (id),
  category text not null,
  details text not null,
  evidence_path text,
  status text not null default 'new',
  review_id uuid references public.reviews (id) on delete set null,
  assigned_to uuid references public.profiles (id),
  resolution_note text not null default '',
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint complaint_category_valid check (
    category in ('safety', 'conduct', 'agreement', 'no_show', 'payment', 'other')
  ),
  constraint complaint_details_not_blank check (char_length(btrim(details)) between 10 and 5000),
  constraint complaint_status_valid check (
    status in ('new', 'in_progress', 'resolved', 'rejected')
  )
);

create index complaints_status_idx on public.complaints (status, created_at desc);
create index complaints_job_idx on public.complaints (job_id);

-- ---------------------------------------------------------------------------
-- Grants and RLS for newly introduced data
-- ---------------------------------------------------------------------------

alter table public.demo_sessions enable row level security;
alter table public.partner_schools enable row level security;
alter table public.lesson_types enable row level security;
alter table public.instructor_lesson_types enable row level security;
alter table public.job_templates enable row level security;
alter table public.job_recurrence_rules enable row level security;
alter table public.job_segments enable row level security;
alter table public.job_application_segments enable row level security;
alter table public.job_segment_confirmations enable row level security;
alter table public.complaints enable row level security;

revoke all on public.demo_sessions from anon, authenticated;
revoke all on public.partner_schools from anon, authenticated;
revoke all on public.lesson_types from anon, authenticated;
revoke all on public.instructor_lesson_types from anon, authenticated;
revoke all on public.job_templates from anon, authenticated;
revoke all on public.job_recurrence_rules from anon, authenticated;
revoke all on public.job_segments from anon, authenticated;
revoke all on public.job_application_segments from anon, authenticated;
revoke all on public.job_segment_confirmations from anon, authenticated;
revoke all on public.complaints from anon, authenticated;

grant select on public.partner_schools to anon, authenticated;
grant insert, update, delete on public.partner_schools to authenticated;
grant select on public.lesson_types to authenticated;
grant insert, update, delete on public.lesson_types to authenticated;
grant select, insert, delete on public.instructor_lesson_types to authenticated;
grant select, insert, update, delete on public.job_templates to authenticated;
grant select, insert, update, delete on public.job_recurrence_rules to authenticated;
grant select, insert, update, delete on public.job_segments to authenticated;
grant select on public.job_application_segments to authenticated;
grant select on public.job_segment_confirmations to authenticated;
grant select, insert on public.complaints to authenticated;
grant update on public.complaints to authenticated;

create policy "actieve partners publiek" on public.partner_schools
  for select to anon, authenticated using (active);

create policy "partners adminbeheer" on public.partner_schools
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

create policy "lestypen zichtbaar" on public.lesson_types
  for select to authenticated using (is_active or private.is_admin());

create policy "lestypen adminbeheer" on public.lesson_types
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

create policy "sjablonen voor organisatie" on public.job_templates
  for all to authenticated
  using (private.is_org_member(organization_id) or private.is_admin())
  with check (
    (created_by = auth.uid() and private.is_org_member(organization_id))
    or private.is_admin()
  );

create policy "herhaling voor betrokkenen" on public.job_recurrence_rules
  for select to authenticated
  using (private.is_job_participant(job_id) or private.is_org_member(private.job_org(job_id)) or private.is_admin());

create policy "herhaling beheren" on public.job_recurrence_rules
  for all to authenticated
  using (private.is_org_member(private.job_org(job_id)) or private.is_admin())
  with check (private.is_org_member(private.job_org(job_id)) or private.is_admin());

create policy "lessegmenten zichtbaar" on public.job_segments
  for select to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_id));

create policy "lessegmenten beheren" on public.job_segments
  for all to authenticated
  using (private.is_org_member(private.job_org(job_id)) or private.is_admin())
  with check (private.is_org_member(private.job_org(job_id)) or private.is_admin());

create policy "gekozen segmenten zichtbaar" on public.job_application_segments
  for select to authenticated
  using (
    exists (
      select 1 from public.job_applications a
      where a.id = application_id
        and (a.instructor_id = auth.uid()
          or private.is_org_member(private.job_org(a.job_id))
          or private.is_admin())
    )
  );

create policy "segmentbevestigingen zichtbaar" on public.job_segment_confirmations
  for select to authenticated
  using (
    instructor_id = auth.uid()
    or private.is_org_member(private.job_org(job_id))
    or private.is_admin()
  );

create policy "klachten voor betrokkenen" on public.complaints
  for select to authenticated
  using (reported_by = auth.uid() or private.is_admin());

create policy "klachten melden" on public.complaints
  for insert to authenticated
  with check (
    reported_by = auth.uid()
    and exists (
      select 1 from public.jobs j
      left join public.job_confirmations jc on jc.job_id = j.id
      where j.id = job_id
        and (
          j.status in ('confirmed', 'completed')
          or (
            j.status = 'open'
            and exists (
              select 1 from public.job_segment_confirmations active_sc
              where active_sc.job_id = j.id
                and active_sc.confirmed_at is not null
                and active_sc.cancelled_at is null
            )
          )
        )
        and (
          jc.instructor_id = auth.uid()
          or exists (
            select 1 from public.job_segment_confirmations sc
            where sc.job_id = j.id
              and sc.instructor_id = auth.uid()
              and sc.confirmed_at is not null
              and sc.cancelled_at is null
          )
          or private.is_org_member(j.organization_id)
        )
    )
  );

create policy "klachten adminbeheer" on public.complaints
  for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- ---------------------------------------------------------------------------
-- Scope helpers: real users never see demo rows; demos only see their session.
-- ---------------------------------------------------------------------------

create or replace function public.current_demo_session_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.demo_session_id from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.demo_scope_matches(target_session uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_admin() then true
    when public.current_demo_session_id() is null then target_session is null
    else target_session = public.current_demo_session_id()
  end;
$$;

revoke all on function public.current_demo_session_id() from public, anon, authenticated;
revoke all on function public.demo_scope_matches(uuid) from public, anon, authenticated;
grant execute on function public.current_demo_session_id() to authenticated;
grant execute on function public.demo_scope_matches(uuid) to authenticated;

-- Keep scope checks out of the exposed public API. These wrappers are used by
-- child-table policies that do not carry a demo_session_id of their own.
create or replace function private.profile_in_demo_scope(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = target_user
      and public.demo_scope_matches(p.demo_session_id)
  );
$$;

create or replace function private.organization_in_demo_scope(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organizations o
    where o.id = target_org
      and public.demo_scope_matches(o.demo_session_id)
  );
$$;

create or replace function private.job_in_demo_scope(target_job uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.jobs j
    where j.id = target_job
      and public.demo_scope_matches(j.demo_session_id)
  );
$$;

revoke all on function private.profile_in_demo_scope(uuid) from public, anon, authenticated;
revoke all on function private.organization_in_demo_scope(uuid) from public, anon, authenticated;
revoke all on function private.job_in_demo_scope(uuid) from public, anon, authenticated;
grant execute on function private.profile_in_demo_scope(uuid) to authenticated;
grant execute on function private.organization_in_demo_scope(uuid) to authenticated;
grant execute on function private.job_in_demo_scope(uuid) to authenticated;

drop policy if exists "profielen zichtbaar voor ingelogden" on public.profiles;
create policy "profielen zichtbaar binnen scope" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.demo_scope_matches(demo_session_id));

drop policy if exists "eigen profiel bijwerken" on public.profiles;
create policy "eigen profiel bijwerken" on public.profiles
  for update to authenticated
  using (id = auth.uid() or private.is_admin())
  with check (
    (
      id = auth.uid()
      and role <> 'admin'
      and demo_session_id is not distinct from public.current_demo_session_id()
    )
    or private.is_admin()
  );

drop policy if exists "instructeursprofielen zichtbaar" on public.instructor_profiles;
create policy "instructeursprofielen zichtbaar binnen scope" on public.instructor_profiles
  for select to authenticated
  using (private.profile_in_demo_scope(user_id));

drop policy if exists "statussen zichtbaar" on public.instructor_statuses;
create policy "statussen zichtbaar binnen scope" on public.instructor_statuses
  for select to authenticated
  using (private.profile_in_demo_scope(user_id));

drop policy if exists "specialisaties zichtbaar" on public.instructor_sports;
create policy "specialisaties zichtbaar binnen scope" on public.instructor_sports
  for select to authenticated
  using (private.profile_in_demo_scope(user_id));

create policy "lesvormspecialisaties zichtbaar binnen scope"
  on public.instructor_lesson_types
  for select to authenticated
  using (private.profile_in_demo_scope(user_id));

create policy "eigen lesvormspecialisaties toevoegen"
  on public.instructor_lesson_types
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and private.profile_in_demo_scope(user_id)
  );

create policy "eigen lesvormspecialisaties verwijderen"
  on public.instructor_lesson_types
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "kwalificaties zichtbaar" on public.instructor_qualifications;
create policy "kwalificaties zichtbaar binnen scope" on public.instructor_qualifications
  for select to authenticated
  using (private.profile_in_demo_scope(user_id));

drop policy if exists "beschikbaarheid zichtbaar" on public.availability_rules;
create policy "beschikbaarheid zichtbaar binnen scope" on public.availability_rules
  for select to authenticated
  using (private.profile_in_demo_scope(user_id));

drop policy if exists "uitzonderingen zichtbaar" on public.availability_exceptions;
create policy "uitzonderingen zichtbaar binnen scope" on public.availability_exceptions
  for select to authenticated
  using (private.profile_in_demo_scope(user_id));

drop policy if exists "organisaties zichtbaar" on public.organizations;
create policy "organisaties zichtbaar binnen scope" on public.organizations
  for select to authenticated using (public.demo_scope_matches(demo_session_id));

drop policy if exists "organisatie aanmaken" on public.organizations;
create policy "organisatie aanmaken" on public.organizations
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and demo_session_id is not distinct from public.current_demo_session_id()
  );

drop policy if exists "organisatie bijwerken" on public.organizations;
create policy "organisatie bijwerken" on public.organizations
  for update to authenticated
  using (private.is_org_owner(id) or private.is_admin())
  with check (
    (
      private.is_org_owner(id)
      and demo_session_id is not distinct from public.current_demo_session_id()
    )
    or private.is_admin()
  );

drop policy if exists "vestigingen zichtbaar" on public.organization_locations;
create policy "vestigingen zichtbaar binnen scope" on public.organization_locations
  for select to authenticated
  using (private.organization_in_demo_scope(organization_id));

drop policy if exists "opdrachten zichtbaar" on public.jobs;
create policy "opdrachten zichtbaar binnen scope" on public.jobs
  for select to authenticated
  using (
    public.demo_scope_matches(demo_session_id)
    and (
      status = 'open'
      or private.is_org_member(organization_id)
      or private.is_admin()
      or private.is_job_participant(id)
    )
  );

drop policy if exists "opdracht bijwerken" on public.jobs;
create policy "opdracht bijwerken" on public.jobs
  for update to authenticated
  using (private.is_org_member(organization_id) or private.is_admin())
  with check (
    (
      private.is_org_member(organization_id)
      and demo_session_id is not distinct from public.current_demo_session_id()
    )
    or private.is_admin()
  );

drop policy if exists "eisen zichtbaar" on public.job_requirements;
create policy "eisen zichtbaar binnen scope" on public.job_requirements
  for select to authenticated
  using (private.job_in_demo_scope(job_id));

drop policy if exists "reviews zichtbaar" on public.reviews;
create policy "reviews zichtbaar binnen scope" on public.reviews
  for select to authenticated
  using (
    reviewer_id = auth.uid()
    or private.is_admin()
    or (released_at is not null and private.job_in_demo_scope(job_id))
  );

drop policy if exists "annuleringen zichtbaar" on public.cancellations;
create policy "annuleringen zichtbaar binnen scope" on public.cancellations
  for select to authenticated
  using (
    private.job_in_demo_scope(job_id)
    and (
      cancelled_by = auth.uid()
      or instructor_id = auth.uid()
      or private.is_admin()
      or private.is_org_member(private.job_org(job_id))
      or private.job_confirmed_instructor(job_id) = auth.uid()
    )
  );

-- A manually entered city has no coordinates. Keep those instructors eligible
-- for every open job, expose a NULL distance to the UI and give the unknown
-- distance a neutral contribution instead of silently ranking it as worst.
-- The function is SECURITY DEFINER, so demo isolation must be explicit here.
create or replace function public.open_job_matches()
returns table (
  job_id uuid,
  distance_km numeric,
  within_travel_distance boolean,
  sport_match boolean,
  missing_qualifications uuid[],
  match_score numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select
      ip.user_id,
      ip.travel_distance_km,
      ip.years_experience,
      c.lat,
      c.lng
    from public.instructor_profiles ip
    join public.profiles p on p.id = ip.user_id
    left join public.cities c on c.id = p.city_id
    where ip.user_id = auth.uid()
  ),
  stats as (
    select * from public.instructor_public_stats(auth.uid())
  ),
  candidates as (
    select
      j.id as job_id,
      j.sport_id,
      me.user_id,
      me.travel_distance_km,
      me.years_experience,
      case
        when me.lat is null or me.lng is null or jc.lat is null or jc.lng is null
          then null
        else public.distance_km(me.lat, me.lng, jc.lat, jc.lng)
      end as calculated_distance
    from public.jobs j
    join public.organization_locations l on l.id = j.location_id
    left join public.cities jc on jc.id = l.city_id
    cross join me
    where j.status = 'open'
      and public.demo_scope_matches(j.demo_session_id)
  )
  select
    candidate.job_id,
    round(candidate.calculated_distance::numeric, 1),
    case
      when candidate.calculated_distance is null then null
      else candidate.calculated_distance <= candidate.travel_distance_km
    end,
    exists (
      select 1 from public.instructor_sports instructor_sport
      where instructor_sport.user_id = candidate.user_id
        and instructor_sport.sport_id = candidate.sport_id
    ),
    coalesce(
      (
        select array_agg(requirement.qualification_id)
        from public.job_requirements requirement
        where requirement.job_id = candidate.job_id
          and not exists (
            select 1
            from public.instructor_qualifications qualification
            where qualification.user_id = candidate.user_id
              and qualification.qualification_id = requirement.qualification_id
          )
      ),
      '{}'::uuid[]
    ),
    round(
      (
        case
          when candidate.calculated_distance is null then 17.5
          else greatest(
            0,
            (1 - least(candidate.calculated_distance, 50) / 50)
          ) * 35
        end
        + case when exists (
            select 1 from public.instructor_sports instructor_sport
            where instructor_sport.user_id = candidate.user_id
              and instructor_sport.sport_id = candidate.sport_id
          ) then 25 else 0 end
        + coalesce((select avg_rating from stats) / 5 * 20, 12)
        + least(candidate.years_experience, 10)
        + greatest(
            0,
            10 - coalesce((select no_show_count from stats), 0) * 5
          )
      )::numeric,
      0
    )
  from candidates candidate;
$$;

revoke all on function public.open_job_matches() from public, anon;
grant execute on function public.open_job_matches() to authenticated;

-- ---------------------------------------------------------------------------
-- Commercial gates: approved VOG and mandatory outstanding reviews
-- ---------------------------------------------------------------------------

create or replace function public.has_valid_vog(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.profile_in_demo_scope(target_user) and exists (
    select 1 from public.document_uploads d
    where d.user_id = target_user
      and d.doc_type = 'vog'
      and d.status = 'approved'
      and (d.expires_at is null or d.expires_at >= current_date)
  );
$$;

create or replace function public.has_pending_review(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.profile_in_demo_scope(target_user) and (
    exists (
      select 1
      from public.jobs j
      join public.job_confirmations jc on jc.job_id = j.id
      where j.status = 'completed'
        and jc.confirmed_at is not null
        and (
          jc.instructor_id = target_user
          or exists (
            select 1 from public.organization_members om
            where om.organization_id = j.organization_id
              and om.user_id = target_user
              and om.state = 'active'
          )
        )
        and not exists (
          select 1 from public.reviews r
          where r.job_id = j.id
            and (
              (jc.instructor_id = target_user and r.side = 'instructor'
                and r.reviewer_id = target_user)
              or (jc.instructor_id <> target_user and r.side = 'organization'
                and r.reviewee_id = jc.instructor_id)
            )
        )
    )
    or exists (
      select 1
      from public.jobs j
      join public.job_segment_confirmations sc on sc.job_id = j.id
      where j.status = 'completed'
        and sc.confirmed_at is not null
        and sc.cancelled_at is null
        and (
          sc.instructor_id = target_user
          or exists (
            select 1 from public.organization_members om
            where om.organization_id = j.organization_id
              and om.user_id = target_user
              and om.state = 'active'
          )
        )
        and not exists (
          select 1 from public.reviews r
          where r.job_id = j.id
            and (
              (sc.instructor_id = target_user and r.side = 'instructor'
                and r.reviewer_id = target_user)
              or (sc.instructor_id <> target_user and r.side = 'organization'
                and r.reviewee_id = sc.instructor_id)
            )
        )
    )
  );
$$;

-- Aggregate only instructors visible in the caller's real/demo scope. Segment
-- confirmations count once per job, just like legacy whole-job confirmations.
create or replace function public.instructor_public_stats(target uuid)
returns table (
  completed_count bigint,
  confirmed_count bigint,
  cancellation_count bigint,
  no_show_count bigint,
  avg_rating numeric,
  review_count bigint,
  reliability_score numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with visible as (
    select private.profile_in_demo_scope(target) as allowed
  ),
  confirmed_jobs as (
    select jc.job_id
    from public.job_confirmations jc
    where jc.instructor_id = target and jc.confirmed_at is not null
    union
    select sc.job_id
    from public.job_segment_confirmations sc
    where sc.instructor_id = target
      and sc.confirmed_at is not null
      and sc.cancelled_at is null
  ),
  c as (
    select count(*) as confirmed from confirmed_jobs
  ),
  done as (
    select count(*) as completed
    from confirmed_jobs cj
    join public.jobs j on j.id = cj.job_id
    where j.status = 'completed'
  ),
  canc as (
    select count(*) as cancellations
    from public.cancellations ca
    where ca.side = 'instructor' and ca.cancelled_by = target
  ),
  ns as (
    select count(*) as no_shows
    from public.no_show_records n
    where n.instructor_id = target
  ),
  rev as (
    select avg(r.rating)::numeric(3, 2) as avg_rating, count(*) as reviews
    from public.reviews r
    where r.reviewee_id = target and r.released_at is not null
  )
  select
    done.completed,
    c.confirmed,
    canc.cancellations,
    ns.no_shows,
    rev.avg_rating,
    rev.reviews,
    case
      when c.confirmed = 0 then null
      else round(
        greatest(
          0,
          least(
            100,
            (done.completed::numeric / c.confirmed) * 55
            + coalesce(rev.avg_rating / 5, 0.7) * 45
            - ns.no_shows * 15
            - canc.cancellations * 5
          )
        ),
        0
      )
    end
  from visible, c, done, canc, ns, rev
  where visible.allowed;
$$;

create or replace function public.instructor_has_schedule_conflict(
  target_user uuid,
  target_job uuid,
  target_start time,
  target_end time
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.jobs existing_job
    join public.job_confirmations confirmation on confirmation.job_id = existing_job.id
    where confirmation.instructor_id = target_user
      and confirmation.confirmed_at is not null
      and existing_job.id <> target_job
      and existing_job.status = 'confirmed'
      and existing_job.starts_on = (select starts_on from public.jobs where id = target_job)
      and existing_job.start_time < target_end
      and existing_job.end_time > target_start
  ) or exists (
    select 1
    from public.job_segment_confirmations confirmation
    join public.job_segments segment on segment.id = confirmation.segment_id
    join public.jobs existing_job on existing_job.id = confirmation.job_id
    where confirmation.instructor_id = target_user
      and confirmation.confirmed_at is not null
      and confirmation.cancelled_at is null
      and existing_job.id <> target_job
      and existing_job.starts_on = (select starts_on from public.jobs where id = target_job)
      and segment.start_time < target_end
      and segment.end_time > target_start
  );
$$;

revoke all on function public.has_valid_vog(uuid) from public, anon;
revoke all on function public.has_pending_review(uuid) from public, anon;
grant execute on function public.has_valid_vog(uuid) to authenticated;
grant execute on function public.has_pending_review(uuid) to authenticated;
revoke all on function public.instructor_has_schedule_conflict(uuid, uuid, time, time)
  from public, anon, authenticated;

drop policy if exists "opdracht plaatsen" on public.jobs;
create policy "opdracht plaatsen" on public.jobs
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and private.is_org_member(organization_id)
    and private.location_has_access(location_id)
    and demo_session_id is not distinct from public.current_demo_session_id()
    and not public.has_pending_review(auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Structured apply flow, including safe contiguous partial block selection.
-- ---------------------------------------------------------------------------

drop function if exists public.apply_to_job(uuid, text, text);
create function public.apply_to_job(
  p_job uuid,
  p_message text default '',
  p_availability_note text default '',
  p_segment_ids uuid[] default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_application uuid;
  v_chat uuid;
  v_name text;
  v_selected_count integer;
  v_min_position integer;
  v_max_position integer;
begin
  select * into v_job from public.jobs where id = p_job;

  if v_job.id is null or v_job.status <> 'open' or not public.demo_scope_matches(v_job.demo_session_id) then
    raise exception 'Deze opdracht staat niet (meer) open voor reacties.';
  end if;
  if not exists (select 1 from public.instructor_profiles ip where ip.user_id = auth.uid()) then
    raise exception 'Alleen instructeurs met een profiel kunnen reageren.';
  end if;
  if not public.instructor_has_access(auth.uid()) then
    raise exception 'Je abonnement of proefperiode is niet actief. Activeer je abonnement om te reageren.';
  end if;
  if not public.has_valid_vog(auth.uid()) then
    raise exception 'Een goedgekeurde, geldige VOG is vereist om te reageren. Open Documenten om je VOG aan te leveren.';
  end if;
  if public.has_pending_review(auth.uid()) then
    raise exception 'Je hebt nog een beoordeling openstaan. Rond die eerst af voordat je reageert.';
  end if;

  if exists (select 1 from public.job_segments s where s.job_id = p_job) then
    if coalesce(cardinality(p_segment_ids), 0) = 0 then
      raise exception 'Kies welke aansluitende lessen je wilt overnemen.';
    end if;

    select count(*), min(s.position), max(s.position)
      into v_selected_count, v_min_position, v_max_position
    from public.job_segments s
    where s.job_id = p_job and s.id = any(p_segment_ids);

    if v_selected_count <> cardinality(p_segment_ids) then
      raise exception 'Eén of meer gekozen lesonderdelen horen niet bij deze opdracht.';
    end if;
    if not v_job.partial_block_allowed and v_selected_count <>
      (select count(*) from public.job_segments s where s.job_id = p_job) then
      raise exception 'Dit volledige lessenblok moet door één instructeur worden overgenomen.';
    end if;
    if v_job.partial_block_allowed and v_max_position - v_min_position + 1 <> v_selected_count then
      raise exception 'Een gedeeltelijke overname moet uit aansluitende lessen bestaan.';
    end if;
    if exists (
      select 1 from public.job_segments s
      where s.job_id = p_job and s.id = any(p_segment_ids)
        and public.instructor_has_schedule_conflict(auth.uid(), p_job, s.start_time, s.end_time)
    ) then
      raise exception 'Een gekozen les overlapt met een al bevestigde opdracht in je agenda.';
    end if;
  elsif public.instructor_has_schedule_conflict(
    auth.uid(), p_job, v_job.start_time, v_job.end_time
  ) then
    raise exception 'Deze opdracht overlapt met een al bevestigde opdracht in je agenda.';
  end if;

  insert into public.job_applications (job_id, instructor_id, message, availability_note)
  values (p_job, auth.uid(), coalesce(p_message, ''), coalesce(p_availability_note, ''))
  returning id into v_application;

  if coalesce(cardinality(p_segment_ids), 0) > 0 then
    insert into public.job_application_segments (application_id, segment_id)
    select v_application, s.id
    from public.job_segments s
    where s.job_id = p_job and s.id = any(p_segment_ids);
  end if;

  select full_name into v_name from public.profiles where id = auth.uid();
  v_chat := public.internal_ensure_chat(p_job, auth.uid());
  perform public.internal_system_message(
    v_chat, 'application_created', v_name || ' heeft gereageerd op "' || v_job.title || '".'
  );
  if coalesce(p_message, '') <> '' then
    insert into public.chat_messages (chat_id, sender_id, body)
    values (v_chat, auth.uid(), p_message);
    update public.chats set last_message_at = now() where id = v_chat;
  end if;
  perform public.internal_notify_org(
    v_job.organization_id, 'application_received',
    'Nieuwe reactie op "' || v_job.title || '"',
    v_name || ' is beschikbaar voor deze opdracht.',
    '/organisatie/opdrachten/' || p_job
  );
  return v_application;
end;
$$;

revoke all on function public.apply_to_job(uuid, text, text, uuid[]) from public, anon;
grant execute on function public.apply_to_job(uuid, text, text, uuid[]) to authenticated;

-- Invitation gates apply both when inviting and when accepting.
create or replace function public.invite_instructor(
  p_job uuid, p_instructor uuid, p_message text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_invitation uuid;
  v_chat uuid;
begin
  select * into v_job from public.jobs where id = p_job;
  if v_job.id is null or not public.is_org_member(v_job.organization_id) then
    raise exception 'Opdracht niet gevonden of geen toegang.';
  end if;
  if v_job.status <> 'open' then
    raise exception 'Alleen open opdrachten kunnen uitnodigingen versturen.';
  end if;
  if public.has_pending_review(auth.uid()) then
    raise exception 'Je hebt nog een beoordeling openstaan. Rond die eerst af.';
  end if;
  if not public.has_valid_vog(p_instructor) then
    raise exception 'Deze instructeur heeft nog geen goedgekeurde, geldige VOG en kan niet worden uitgenodigd.';
  end if;
  if not public.location_has_access(v_job.location_id) then
    raise exception 'Het abonnement voor deze vestiging is niet actief.';
  end if;
  insert into public.job_invitations (job_id, instructor_id, invited_by, message)
  values (p_job, p_instructor, auth.uid(), coalesce(p_message, ''))
  returning id into v_invitation;
  v_chat := public.internal_ensure_chat(p_job, p_instructor);
  perform public.internal_system_message(
    v_chat, 'invitation_sent', 'De organisatie heeft een uitnodiging gestuurd voor "' || v_job.title || '".'
  );
  perform public.internal_notify(
    p_instructor, 'invitation_received', 'Uitnodiging: ' || v_job.title,
    'Een organisatie nodigt je uit voor deze opdracht.', '/opdrachten/' || p_job
  );
  return v_invitation;
end;
$$;

create or replace function public.respond_invitation(
  p_invitation uuid, p_accept boolean, p_message text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.job_invitations;
  v_chat uuid;
begin
  select * into v_inv from public.job_invitations where id = p_invitation;
  if v_inv.id is null or v_inv.instructor_id <> auth.uid() then
    raise exception 'Uitnodiging niet gevonden.';
  end if;
  if v_inv.status <> 'pending' then
    raise exception 'Deze uitnodiging is al beantwoord.';
  end if;
  if p_accept then
    if not public.instructor_has_access(auth.uid()) then
      raise exception 'Je abonnement of proefperiode is niet actief. Activeer je abonnement om te reageren.';
    end if;
    if not public.has_valid_vog(auth.uid()) then
      raise exception 'Een goedgekeurde, geldige VOG is vereist om een uitnodiging te accepteren.';
    end if;
    if public.has_pending_review(auth.uid()) then
      raise exception 'Je hebt nog een beoordeling openstaan. Rond die eerst af.';
    end if;
    update public.job_invitations set status = 'accepted' where id = p_invitation;
    insert into public.job_applications (job_id, instructor_id, message)
    values (v_inv.job_id, auth.uid(), coalesce(p_message, ''))
    on conflict (job_id, instructor_id) do nothing;
    v_chat := public.internal_ensure_chat(v_inv.job_id, auth.uid());
    perform public.internal_system_message(v_chat, 'invitation_accepted', 'De instructeur heeft de uitnodiging geaccepteerd.');
  else
    update public.job_invitations set status = 'declined' where id = p_invitation;
    v_chat := public.internal_ensure_chat(v_inv.job_id, auth.uid());
    perform public.internal_system_message(v_chat, 'invitation_declined', 'De instructeur heeft de uitnodiging afgeslagen.');
  end if;
end;
$$;

-- Candidate selection is blocked until both commercial gates are satisfied.
create or replace function public.select_candidate(
  p_application uuid, p_terms jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app public.job_applications;
  v_job public.jobs;
  v_confirmation uuid;
  v_chat uuid;
begin
  select * into v_app from public.job_applications where id = p_application;
  if v_app.id is null then raise exception 'Reactie niet gevonden.'; end if;
  select * into v_job from public.jobs where id = v_app.job_id;
  if not public.is_org_member(v_job.organization_id) then raise exception 'Geen toegang tot deze opdracht.'; end if;
  if v_job.status <> 'open' then raise exception 'Deze opdracht staat niet meer open.'; end if;
  if public.has_pending_review(auth.uid()) then
    raise exception 'Je hebt nog een beoordeling openstaan. Rond die eerst af.';
  end if;
  if not public.has_valid_vog(v_app.instructor_id) then
    raise exception 'Deze kandidaat heeft geen goedgekeurde, geldige VOG en kan niet definitief worden geselecteerd.';
  end if;
  if not public.location_has_access(v_job.location_id) then
    raise exception 'Het abonnement voor deze vestiging is niet actief.';
  end if;
  if exists (select 1 from public.job_segments s where s.job_id = v_job.id) then
    raise exception 'Gebruik de segmentselectie voor een lessenblok.';
  end if;
  if public.instructor_has_schedule_conflict(
    v_app.instructor_id, v_job.id, v_job.start_time, v_job.end_time
  ) then
    raise exception 'Deze kandidaat is op dit tijdstip al definitief ingepland.';
  end if;
  insert into public.job_confirmations
    (job_id, application_id, instructor_id, terms, organization_agreed_at, organization_agreed_by)
  values (v_job.id, p_application, v_app.instructor_id, coalesce(p_terms, '{}'::jsonb), now(), auth.uid())
  on conflict (job_id) do update
    set application_id = excluded.application_id,
        instructor_id = excluded.instructor_id,
        terms = excluded.terms,
        organization_agreed_at = excluded.organization_agreed_at,
        organization_agreed_by = excluded.organization_agreed_by,
        instructor_agreed_at = null,
        confirmed_at = null
  returning id into v_confirmation;
  v_chat := public.internal_ensure_chat(v_job.id, v_app.instructor_id);
  perform public.internal_system_message(v_chat, 'candidate_selected', 'De organisatie is akkoord met de opdrachtvoorwaarden en wacht op jouw bevestiging.');
  perform public.internal_notify(
    v_app.instructor_id, 'confirmation_requested', 'Bevestiging gevraagd: ' || v_job.title,
    'De organisatie heeft jou gekozen. Bevestig de opdracht om definitief te worden.',
    '/opdrachten/' || v_job.id
  );
  return v_confirmation;
end;
$$;

create or replace function public.select_candidate_segments(
  p_application uuid,
  p_segment_ids uuid[],
  p_terms jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app public.job_applications;
  v_job public.jobs;
  v_segment public.job_segments;
  v_count integer := 0;
  v_selected_count integer;
  v_min_position integer;
  v_max_position integer;
begin
  select * into v_app from public.job_applications where id = p_application;
  if v_app.id is null then raise exception 'Reactie niet gevonden.'; end if;
  select * into v_job from public.jobs where id = v_app.job_id;
  if not public.is_org_member(v_job.organization_id) then raise exception 'Geen toegang tot deze opdracht.'; end if;
  if v_job.status <> 'open' then raise exception 'Dit lessenblok staat niet meer open.'; end if;
  if public.has_pending_review(auth.uid()) then
    raise exception 'Je hebt nog een beoordeling openstaan. Rond die eerst af.';
  end if;
  if not public.has_valid_vog(v_app.instructor_id) then
    raise exception 'Deze kandidaat heeft geen goedgekeurde, geldige VOG.';
  end if;
  if coalesce(cardinality(p_segment_ids), 0) = 0 then raise exception 'Kies minimaal één les.'; end if;
  select count(*), min(s.position), max(s.position)
    into v_selected_count, v_min_position, v_max_position
  from public.job_segments s
  where s.job_id = v_job.id and s.id = any(p_segment_ids);
  if v_selected_count <> cardinality(p_segment_ids) then
    raise exception 'Eén of meer gekozen lesonderdelen horen niet bij dit lessenblok.';
  end if;
  if not v_job.partial_block_allowed and v_selected_count <>
    (select count(*) from public.job_segments s where s.job_id = v_job.id) then
    raise exception 'Dit volledige lessenblok moet door één instructeur worden overgenomen.';
  end if;
  if v_job.partial_block_allowed
    and v_max_position - v_min_position + 1 <> v_selected_count then
    raise exception 'De gekozen lesonderdelen moeten direct op elkaar aansluiten.';
  end if;
  if exists (
    select 1 from unnest(p_segment_ids) selected(id)
    where not exists (
      select 1 from public.job_application_segments jas
      join public.job_segments s on s.id = jas.segment_id
      where jas.application_id = p_application
        and jas.segment_id = selected.id
        and s.job_id = v_job.id
    )
  ) then
    raise exception 'De kandidaat heeft niet op alle gekozen lessen gereageerd.';
  end if;
  if exists (
    select 1 from public.job_segment_confirmations c
    where c.segment_id = any(p_segment_ids)
      and c.cancelled_at is null
  ) then
    raise exception 'Minimaal één gekozen les is al aan iemand toegewezen.';
  end if;

  for v_segment in
    select * from public.job_segments s
    where s.job_id = v_job.id and s.id = any(p_segment_ids)
    order by s.position
  loop
    if public.instructor_has_schedule_conflict(
      v_app.instructor_id, v_job.id, v_segment.start_time, v_segment.end_time
    ) then
      raise exception 'Deze kandidaat is tijdens een gekozen les al definitief ingepland.';
    end if;
    insert into public.job_segment_confirmations (
      job_id, segment_id, application_id, instructor_id, terms,
      organization_agreed_by
    ) values (
      v_job.id, v_segment.id, p_application, v_app.instructor_id,
      coalesce(p_terms, '{}'::jsonb), auth.uid()
    );
    v_count := v_count + 1;
  end loop;

  perform public.internal_notify(
    v_app.instructor_id, 'segment_confirmation_requested',
    'Bevestiging gevraagd: ' || v_job.title,
    'De sportschool heeft je voor ' || v_count || ' aansluitende les(sen) gekozen.',
    '/opdrachten/' || v_job.id
  );
  return v_count;
end;
$$;

create or replace function public.confirm_job_segments(p_job uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_confirmation public.job_segment_confirmations;
  v_count integer := 0;
begin
  select * into v_job from public.jobs where id = p_job;
  if v_job.id is null then raise exception 'Opdracht niet gevonden.'; end if;
  if not public.has_valid_vog(auth.uid()) then
    raise exception 'Een goedgekeurde, geldige VOG is vereist om definitief te bevestigen.';
  end if;
  if public.has_pending_review(auth.uid()) then
    raise exception 'Je hebt nog een beoordeling openstaan. Rond die eerst af.';
  end if;
  for v_confirmation in
    select c.* from public.job_segment_confirmations c
    where c.job_id = p_job
      and c.instructor_id = auth.uid()
      and c.confirmed_at is null
      and c.cancelled_at is null
    order by c.created_at
  loop
    if exists (
      select 1 from public.job_segments s
      where s.id = v_confirmation.segment_id
        and public.instructor_has_schedule_conflict(auth.uid(), p_job, s.start_time, s.end_time)
    ) then
      raise exception 'Een les overlapt inmiddels met een andere bevestigde opdracht.';
    end if;
    update public.job_segment_confirmations
    set instructor_agreed_at = now(), confirmed_at = now()
    where id = v_confirmation.id;
    update public.job_applications set status = 'accepted'
    where id = v_confirmation.application_id;
    v_count := v_count + 1;
  end loop;
  if v_count = 0 then raise exception 'Er staan geen lesonderdelen voor jou klaar.'; end if;

  if not exists (
    select 1 from public.job_segments s
    where s.job_id = p_job
      and not exists (
        select 1 from public.job_segment_confirmations c
        where c.segment_id = s.id
          and c.confirmed_at is not null
          and c.cancelled_at is null
      )
  ) then
    update public.jobs set status = 'confirmed' where id = p_job;
  end if;

  perform public.internal_notify_org(
    v_job.organization_id, 'job_segments_confirmed',
    'Lessen bevestigd: ' || v_job.title,
    v_count || ' lesonderdeel/lesonderdelen zijn definitief bevestigd.',
    '/organisatie/opdrachten/' || p_job
  );
  return v_count;
end;
$$;

create or replace function public.confirm_job(p_job uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conf public.job_confirmations;
  v_job public.jobs;
  v_chat uuid;
begin
  select * into v_conf from public.job_confirmations where job_id = p_job;
  if v_conf.id is null or v_conf.instructor_id <> auth.uid() then
    raise exception 'Er staat geen bevestiging voor jou klaar bij deze opdracht.';
  end if;
  if v_conf.organization_agreed_at is null then raise exception 'De organisatie moet eerst akkoord gaan.'; end if;
  if v_conf.confirmed_at is not null then raise exception 'Deze opdracht is al bevestigd.'; end if;
  if not public.instructor_has_access(auth.uid()) then
    raise exception 'Je abonnement of proefperiode is niet actief.';
  end if;
  if not public.has_valid_vog(auth.uid()) then
    raise exception 'Een goedgekeurde, geldige VOG is vereist om definitief te bevestigen.';
  end if;
  if public.has_pending_review(auth.uid()) then
    raise exception 'Je hebt nog een beoordeling openstaan. Rond die eerst af.';
  end if;
  select * into v_job from public.jobs where id = p_job;
  if public.instructor_has_schedule_conflict(
    auth.uid(), p_job, v_job.start_time, v_job.end_time
  ) then
    raise exception 'Deze opdracht overlapt met een andere bevestigde opdracht in je agenda.';
  end if;
  update public.job_confirmations
  set instructor_agreed_at = now(), confirmed_at = now()
  where id = v_conf.id;
  update public.jobs set status = 'confirmed' where id = p_job;
  update public.job_applications set status = 'accepted' where id = v_conf.application_id;
  update public.job_applications
  set status = 'rejected'
  where job_id = p_job and id <> v_conf.application_id and status = 'pending';
  v_chat := public.internal_ensure_chat(p_job, auth.uid());
  perform public.internal_system_message(v_chat, 'job_confirmed',
    'De opdracht is definitief bevestigd. Contactgegevens zijn nu zichtbaar voor beide partijen.');
  perform public.internal_notify_org(v_job.organization_id, 'job_confirmed',
    'Opdracht bevestigd: ' || v_job.title, 'De instructeur heeft de opdracht bevestigd.',
    '/agenda?job=' || p_job);
end;
$$;

create or replace function public.get_job_contact_details(p_job uuid)
returns table (full_name text, email text, phone text, side public.party_side)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_conf public.job_confirmations;
  v_job public.jobs;
begin
  select * into v_job from public.jobs where id = p_job;
  if v_job.id is null then return; end if;
  select * into v_conf
  from public.job_confirmations
  where job_id = p_job and confirmed_at is not null
  limit 1;

  if v_conf.id is not null and v_conf.instructor_id = auth.uid() then
    return query
    select o.contact_name, o.contact_email, o.contact_phone, 'organization'::public.party_side
    from public.organizations o where o.id = v_job.organization_id;
  elsif v_conf.id is not null and public.is_org_member(v_job.organization_id) then
    return query
    select p.full_name, p.email, p.phone, 'instructor'::public.party_side
    from public.profiles p where p.id = v_conf.instructor_id;
  elsif exists (
    select 1 from public.job_segment_confirmations c
    where c.job_id = p_job
      and c.instructor_id = auth.uid()
      and c.confirmed_at is not null
      and c.cancelled_at is null
  ) then
    return query
    select o.contact_name, o.contact_email, o.contact_phone, 'organization'::public.party_side
    from public.organizations o where o.id = v_job.organization_id;
  elsif public.is_org_member(v_job.organization_id) then
    return query
    select distinct p.full_name, p.email, p.phone, 'instructor'::public.party_side
    from public.job_segment_confirmations c
    join public.profiles p on p.id = c.instructor_id
    where c.job_id = p_job
      and c.confirmed_at is not null
      and c.cancelled_at is null;
  end if;
end;
$$;

revoke all on function public.select_candidate_segments(uuid, uuid[], jsonb) from public, anon;
revoke all on function public.confirm_job_segments(uuid) from public, anon;
grant execute on function public.select_candidate_segments(uuid, uuid[], jsonb) to authenticated;
grant execute on function public.confirm_job_segments(uuid) to authenticated;

-- Complete either a legacy whole job or a fully assigned lesson block. Every
-- confirmed block instructor receives their own review request.
create or replace function public.complete_job(p_job uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_conf public.job_confirmations;
  v_instructor uuid;
  v_chat uuid;
begin
  select * into v_job from public.jobs where id = p_job;
  if v_job.id is null or not public.is_org_member(v_job.organization_id) then
    raise exception 'Geen toegang tot deze opdracht.';
  end if;
  if v_job.status <> 'confirmed' then
    raise exception 'Alleen bevestigde opdrachten kunnen worden afgerond.';
  end if;

  select * into v_conf
  from public.job_confirmations
  where job_id = p_job and confirmed_at is not null;

  if v_conf.id is null then
    if not exists (
      select 1 from public.job_segment_confirmations sc
      where sc.job_id = p_job
        and sc.confirmed_at is not null
        and sc.cancelled_at is null
    ) then
      raise exception 'Deze opdracht heeft geen bevestigde instructeur.';
    end if;
    if exists (
      select 1 from public.job_segments s
      where s.job_id = p_job
        and not exists (
          select 1 from public.job_segment_confirmations sc
          where sc.segment_id = s.id
            and sc.confirmed_at is not null
            and sc.cancelled_at is null
        )
    ) then
      raise exception 'Nog niet alle lessen in dit blok zijn definitief toegewezen.';
    end if;
  end if;

  update public.jobs set status = 'completed' where id = p_job;

  if v_conf.id is not null then
    v_chat := public.internal_ensure_chat(p_job, v_conf.instructor_id);
    perform public.internal_system_message(
      v_chat, 'review_available',
      'De opdracht is afgerond. Jullie kunnen elkaar nu beoordelen.'
    );
    perform public.internal_notify(
      v_conf.instructor_id, 'review_available', 'Beoordeel de samenwerking',
      'De opdracht "' || v_job.title || '" is afgerond. Laat een beoordeling achter.',
      '/opdrachten/' || p_job
    );
  else
    for v_instructor in
      select distinct sc.instructor_id
      from public.job_segment_confirmations sc
      where sc.job_id = p_job
        and sc.confirmed_at is not null
        and sc.cancelled_at is null
    loop
      v_chat := public.internal_ensure_chat(p_job, v_instructor);
      perform public.internal_system_message(
        v_chat, 'review_available',
        'Het lessenblok is afgerond. Jullie kunnen elkaar nu beoordelen.'
      );
      perform public.internal_notify(
        v_instructor, 'review_available', 'Beoordeel de samenwerking',
        'Het lessenblok "' || v_job.title || '" is afgerond. Laat een beoordeling achter.',
        '/opdrachten/' || p_job
      );
    end loop;
  end if;

  perform public.internal_notify_org(
    v_job.organization_id, 'review_available', 'Beoordeel de instructeur',
    'De opdracht "' || v_job.title || '" is afgerond. Laat de openstaande beoordeling(en) achter.',
    '/organisatie/opdrachten/' || p_job
  );
end;
$$;

revoke all on function public.complete_job(uuid) from public, anon;
grant execute on function public.complete_job(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Stop searching, cancellation calculation and force-majeure review
-- ---------------------------------------------------------------------------

create or replace function public.stop_job_search(
  p_job uuid, p_reason text, p_note text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_job public.jobs;
begin
  select * into v_job from public.jobs where id = p_job;
  if v_job.id is null or not public.is_org_member(v_job.organization_id) then
    raise exception 'Opdracht niet gevonden of geen toegang.';
  end if;
  if v_job.status <> 'open' then raise exception 'Alleen een open opdracht kan stoppen met zoeken.'; end if;
  if exists (
    select 1 from public.job_segment_confirmations sc
    where sc.job_id = p_job
      and sc.confirmed_at is not null
      and sc.cancelled_at is null
  ) then
    raise exception 'Dit lessenblok bevat al bevestigde lessen. Annuleer die via de annuleringsflow.';
  end if;
  if p_reason not in ('match_via_sportmatch','internal_match','lesson_cancelled','no_longer_needed','other') then
    raise exception 'Kies een geldige reden.';
  end if;
  if p_reason = 'match_via_sportmatch' then
    raise exception 'Een SportMatch-match rond je af via kandidaatselectie en bevestiging.';
  end if;
  update public.jobs
  set status = 'closed', closed_reason = p_reason, closed_note = coalesce(p_note, ''),
      closed_at = now(), closed_by = auth.uid()
  where id = p_job;
end;
$$;

drop function if exists public.cancel_confirmed_job(uuid, text);
drop function if exists public.cancel_confirmed_job(uuid, text, boolean, text);
create function public.cancel_confirmed_job(
  p_job uuid,
  p_reason text default '',
  p_force_majeure boolean default false,
  p_evidence_path text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_conf public.job_confirmations;
  v_side public.party_side;
  v_hours numeric;
  v_base_amount integer;
  v_compensation integer;
  v_chat uuid;
  v_assignment record;
  v_total_segment_seconds numeric;
begin
  select * into v_job from public.jobs where id = p_job;
  if v_job.id is null or v_job.status not in ('confirmed', 'open') then
    raise exception 'Alleen bevestigde opdrachten kunnen worden geannuleerd.';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Geef een duidelijke reden voor de annulering.';
  end if;

  select * into v_conf
  from public.job_confirmations
  where job_id = p_job and confirmed_at is not null;
  v_hours := extract(epoch from (public.internal_job_starts_at(p_job) - now())) / 3600;

  if v_conf.id is not null then
    if v_conf.instructor_id = auth.uid() then v_side := 'instructor';
    elsif public.is_org_member(v_job.organization_id) then v_side := 'organization';
    else raise exception 'Geen toegang tot deze opdracht.'; end if;

    v_base_amount := case
      when v_job.pay_type = 'fixed'
        or (v_job.pay_type = 'both' and v_job.pay_amount_cents is not null)
        then coalesce(v_job.pay_amount_cents, 0)
      else round(
        coalesce(v_job.pay_hourly_rate_cents, 0)
        * extract(epoch from (v_job.end_time - v_job.start_time)) / 3600
      )::integer
    end;
    v_compensation := round(v_base_amount * 1.5)::integer;

    insert into public.cancellations (
      job_id, cancelled_by, side, instructor_id, reason, hours_before_start,
      compensation_pct, compensation_amount_cents, compensation_note,
      force_majeure_claimed, force_majeure_status, evidence_path
    ) values (
      p_job, auth.uid(), v_side, v_conf.instructor_id, btrim(p_reason),
      round(v_hours, 2), 150, v_compensation,
      '150% van de totale afgesproken vergoeding; registratie zonder automatische betaling.',
      p_force_majeure,
      case when p_force_majeure then 'pending_review' else 'not_requested' end,
      nullif(p_evidence_path, '')
    );
    update public.jobs set status = 'cancelled' where id = p_job;
    v_chat := public.internal_ensure_chat(p_job, v_conf.instructor_id);
    perform public.internal_system_message(
      v_chat, 'job_cancelled',
      case when v_side = 'instructor'
        then 'De instructeur heeft de opdracht geannuleerd.'
        else 'De organisatie heeft de opdracht geannuleerd.' end
      || ' Geregistreerde annuleringsvergoeding: 150% (€ '
      || trim(to_char(v_compensation / 100.0, 'FM999999990D00')) || ').'
      || case when p_force_majeure
        then ' Het overmachtsverzoek wacht op beoordeling door SportMatch.'
        else '' end
    );
    if v_side = 'instructor' then
      perform public.internal_notify_org(
        v_job.organization_id, 'job_cancelled',
        'Opdracht geannuleerd: ' || v_job.title,
        'De instructeur heeft geannuleerd. Bekijk de annuleringsregistratie.',
        '/organisatie/opdrachten/' || p_job
      );
    else
      perform public.internal_notify(
        v_conf.instructor_id, 'job_cancelled',
        'Opdracht geannuleerd: ' || v_job.title,
        'De sportschool heeft geannuleerd. Bekijk de annuleringsregistratie.',
        '/opdrachten/' || p_job
      );
    end if;
    return;
  end if;

  -- Segmentblokken registreren de vergoeding per betrokken instructeur. Bij
  -- een vast totaalbedrag wordt het bedrag naar tijdsduur verdeeld.
  if not exists (
    select 1 from public.job_segment_confirmations sc
    where sc.job_id = p_job
      and sc.confirmed_at is not null
      and sc.cancelled_at is null
  ) then
    raise exception 'Deze opdracht heeft geen actieve bevestigde lessen.';
  end if;

  if public.is_org_member(v_job.organization_id) then
    v_side := 'organization';
  elsif exists (
    select 1 from public.job_segment_confirmations sc
    where sc.job_id = p_job
      and sc.instructor_id = auth.uid()
      and sc.confirmed_at is not null
      and sc.cancelled_at is null
  ) then
    v_side := 'instructor';
  else
    raise exception 'Geen toegang tot dit lessenblok.';
  end if;

  select sum(extract(epoch from (s.end_time - s.start_time)))
    into v_total_segment_seconds
  from public.job_segments s where s.job_id = p_job;

  for v_assignment in
    select
      sc.instructor_id,
      array_agg(sc.segment_id order by s.position) as segment_ids,
      sum(extract(epoch from (s.end_time - s.start_time))) as seconds
    from public.job_segment_confirmations sc
    join public.job_segments s on s.id = sc.segment_id
    where sc.job_id = p_job
      and sc.confirmed_at is not null
      and sc.cancelled_at is null
      and (v_side = 'organization' or sc.instructor_id = auth.uid())
    group by sc.instructor_id
  loop
    v_base_amount := case
      when v_job.pay_type = 'fixed'
        or (v_job.pay_type = 'both' and v_job.pay_amount_cents is not null)
        then round(
          coalesce(v_job.pay_amount_cents, 0)
          * v_assignment.seconds / nullif(v_total_segment_seconds, 0)
        )::integer
      else round(
        coalesce(v_job.pay_hourly_rate_cents, 0)
        * v_assignment.seconds / 3600
      )::integer
    end;
    v_compensation := round(v_base_amount * 1.5)::integer;

    insert into public.cancellations (
      job_id, cancelled_by, side, instructor_id, segment_ids, reason,
      hours_before_start, compensation_pct, compensation_amount_cents,
      compensation_note, force_majeure_claimed, force_majeure_status,
      evidence_path
    ) values (
      p_job, auth.uid(), v_side, v_assignment.instructor_id,
      v_assignment.segment_ids, btrim(p_reason), round(v_hours, 2), 150,
      v_compensation,
      '150% van de afgesproken vergoeding voor de geannuleerde lesonderdelen; registratie zonder automatische betaling.',
      p_force_majeure,
      case when p_force_majeure then 'pending_review' else 'not_requested' end,
      nullif(p_evidence_path, '')
    );

    update public.job_segment_confirmations
    set cancelled_at = now(), cancelled_by = auth.uid()
    where job_id = p_job
      and instructor_id = v_assignment.instructor_id
      and segment_id = any(v_assignment.segment_ids)
      and cancelled_at is null;

    v_chat := public.internal_ensure_chat(p_job, v_assignment.instructor_id);
    perform public.internal_system_message(
      v_chat, 'job_cancelled',
      case when v_side = 'instructor'
        then 'De instructeur heeft de toegewezen lesonderdelen geannuleerd.'
        else 'De organisatie heeft de toegewezen lesonderdelen geannuleerd.' end
      || ' Geregistreerde annuleringsvergoeding: 150% (€ '
      || trim(to_char(v_compensation / 100.0, 'FM999999990D00')) || ').'
    );
    if v_side = 'organization' then
      perform public.internal_notify(
        v_assignment.instructor_id, 'job_cancelled',
        'Lessen geannuleerd: ' || v_job.title,
        'De sportschool heeft jouw lesonderdelen geannuleerd.',
        '/opdrachten/' || p_job
      );
    end if;
  end loop;

  if v_side = 'organization' then
    update public.jobs set status = 'cancelled' where id = p_job;
  else
    update public.jobs set status = 'open' where id = p_job;
    update public.job_applications a
    set status = 'withdrawn'
    where a.job_id = p_job
      and a.instructor_id = auth.uid()
      and not exists (
        select 1 from public.job_segment_confirmations sc
        where sc.application_id = a.id and sc.cancelled_at is null
      );
    perform public.internal_notify_org(
      v_job.organization_id, 'job_cancelled',
      'Lesonderdelen opnieuw te plannen: ' || v_job.title,
      'Een instructeur heeft toegewezen lessen geannuleerd. Deze onderdelen kunnen opnieuw worden toegewezen.',
      '/organisatie/opdrachten/' || p_job
    );
  end if;
end;
$$;

create or replace function public.admin_review_force_majeure(
  p_cancellation uuid, p_approve boolean, p_note text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Alleen admins kunnen overmacht beoordelen.'; end if;
  update public.cancellations
  set force_majeure_status = case when p_approve then 'approved' else 'rejected' end,
      compensation_amount_cents = case when p_approve then 0 else compensation_amount_cents end,
      admin_adjusted = true,
      admin_note = coalesce(p_note, ''),
      reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_cancellation and force_majeure_status = 'pending_review';
  if not found then raise exception 'Openstaand overmachtsverzoek niet gevonden.'; end if;
end;
$$;

revoke all on function public.stop_job_search(uuid, text, text) from public, anon;
revoke all on function public.cancel_confirmed_job(uuid, text, boolean, text) from public, anon;
revoke all on function public.admin_review_force_majeure(uuid, boolean, text) from public, anon;
grant execute on function public.stop_job_search(uuid, text, text) to authenticated;
grant execute on function public.cancel_confirmed_job(uuid, text, boolean, text) to authenticated;
grant execute on function public.admin_review_force_majeure(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Review comments and direct complaint creation
-- ---------------------------------------------------------------------------

drop function if exists public.submit_review(uuid, integer);
drop function if exists public.submit_review(uuid, integer, text);
create function public.submit_review(
  p_job uuid,
  p_rating integer,
  p_comment text default '',
  p_reviewee uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_conf public.job_confirmations;
  v_side public.party_side;
  v_reviewee uuid;
  v_review uuid;
begin
  select * into v_job from public.jobs where id = p_job;
  if v_job.id is null or v_job.status <> 'completed' then
    raise exception 'Alleen afgeronde opdrachten kunnen worden beoordeeld.';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Een beoordeling is 1 tot en met 5 sterren.';
  end if;
  select * into v_conf
  from public.job_confirmations
  where job_id = p_job and confirmed_at is not null;

  if v_conf.id is not null and v_conf.instructor_id = auth.uid() then
    v_side := 'instructor'; v_reviewee := v_job.created_by;
  elsif v_conf.id is not null and public.is_org_member(v_job.organization_id) then
    v_side := 'organization'; v_reviewee := v_conf.instructor_id;
  elsif exists (
    select 1 from public.job_segment_confirmations sc
    where sc.job_id = p_job
      and sc.instructor_id = auth.uid()
      and sc.confirmed_at is not null
      and sc.cancelled_at is null
  ) then
    v_side := 'instructor'; v_reviewee := v_job.created_by;
  elsif public.is_org_member(v_job.organization_id) then
    v_side := 'organization';
    if p_reviewee is not null and exists (
      select 1 from public.job_segment_confirmations sc
      where sc.job_id = p_job
        and sc.instructor_id = p_reviewee
        and sc.confirmed_at is not null
        and sc.cancelled_at is null
    ) then
      v_reviewee := p_reviewee;
    else
      select (array_agg(distinct sc.instructor_id))[1]
      into v_reviewee
      from public.job_segment_confirmations sc
      where sc.job_id = p_job
        and sc.confirmed_at is not null
        and sc.cancelled_at is null
      having count(distinct sc.instructor_id) = 1;
    end if;
    if v_reviewee is null then
      raise exception 'Kies welke instructeur je beoordeelt.';
    end if;
  else
    raise exception 'Alleen betrokkenen kunnen beoordelen.';
  end if;
  insert into public.reviews (job_id, reviewer_id, reviewee_id, side, rating, comment)
  values (p_job, auth.uid(), v_reviewee, v_side, p_rating, left(coalesce(p_comment, ''), 2000))
  returning id into v_review;
  return v_review;
end;
$$;

revoke all on function public.submit_review(uuid, integer, text, uuid) from public, anon;
grant execute on function public.submit_review(uuid, integer, text, uuid) to authenticated;

-- Reviews remain double blind per instructor, also when one lesson block has
-- multiple instructors.
create or replace function public.release_reviews_when_complete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_instructor uuid;
begin
  v_instructor := case
    when new.side = 'organization' then new.reviewee_id
    else new.reviewer_id
  end;

  if exists (
    select 1 from public.reviews r
    where r.job_id = new.job_id
      and r.side = 'organization'
      and r.reviewee_id = v_instructor
  ) and exists (
    select 1 from public.reviews r
    where r.job_id = new.job_id
      and r.side = 'instructor'
      and r.reviewer_id = v_instructor
  ) then
    update public.reviews
    set released_at = coalesce(released_at, now())
    where job_id = new.job_id
      and (
        (side = 'organization' and reviewee_id = v_instructor)
        or (side = 'instructor' and reviewer_id = v_instructor)
      );
  end if;
  return new;
end;
$$;

revoke all on function public.release_reviews_when_complete()
  from public, anon, authenticated;

create or replace function public.enforce_replacement_vog()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_valid_vog(new.proposed_instructor_id) then
    raise exception 'De voorgestelde vervanger heeft geen goedgekeurde, geldige VOG.';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_replacement_vog()
  from public, anon, authenticated;

create trigger replacements_require_valid_vog
before insert or update of proposed_instructor_id on public.replacements
for each row execute function public.enforce_replacement_vog();

create or replace function public.enforce_lesson_type_sport()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sport uuid;
begin
  if tg_table_name = 'jobs' then
    v_sport := new.sport_id;
  else
    select j.sport_id into v_sport
    from public.jobs j where j.id = new.job_id;
  end if;

  if new.lesson_type_id is not null and not exists (
    select 1 from public.lesson_types lt
    where lt.id = new.lesson_type_id and lt.sport_id = v_sport
  ) then
    raise exception 'De gekozen lesvorm hoort niet bij deze sport.';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_lesson_type_sport()
  from public, anon, authenticated;

create trigger jobs_lesson_type_matches_sport
before insert or update of sport_id, lesson_type_id on public.jobs
for each row execute function public.enforce_lesson_type_sport();

create trigger segments_lesson_type_matches_job_sport
before insert or update of job_id, lesson_type_id on public.job_segments
for each row execute function public.enforce_lesson_type_sport();

-- New table triggers reuse the standard updated-at function.
create trigger partner_schools_set_updated_at before update on public.partner_schools
for each row execute function public.set_updated_at();
create trigger job_templates_set_updated_at before update on public.job_templates
for each row execute function public.set_updated_at();
create trigger segment_confirmations_set_updated_at before update on public.job_segment_confirmations
for each row execute function public.set_updated_at();
create trigger complaints_set_updated_at before update on public.complaints
for each row execute function public.set_updated_at();

-- Ensure no newly created SECURITY DEFINER function remains PUBLIC executable.
revoke all on function public.current_demo_session_id() from public;
revoke all on function public.demo_scope_matches(uuid) from public;
revoke all on function public.has_valid_vog(uuid) from public;
revoke all on function public.has_pending_review(uuid) from public;
revoke all on function public.apply_to_job(uuid, text, text, uuid[]) from public;
revoke all on function public.invite_instructor(uuid, uuid, text) from public;
revoke all on function public.respond_invitation(uuid, boolean, text) from public;
revoke all on function public.select_candidate(uuid, jsonb) from public;
revoke all on function public.stop_job_search(uuid, text, text) from public;
revoke all on function public.cancel_confirmed_job(uuid, text, boolean, text) from public;
revoke all on function public.admin_review_force_majeure(uuid, boolean, text) from public;
revoke all on function public.submit_review(uuid, integer, text, uuid) from public;
revoke all on function public.complete_job(uuid) from public;
revoke all on function public.release_reviews_when_complete() from public;
revoke all on function public.enforce_replacement_vog() from public;
revoke all on function public.enforce_lesson_type_sport() from public;

-- The chat client subscribes to inserts. The repository declared this in
-- 0004, but the audited live publication did not contain these tables.
do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    return;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
