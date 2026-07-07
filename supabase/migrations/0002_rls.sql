-- SportMatch ZZP — 0002: grants, RLS-helpers en policies

set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- Grants: expliciet en beperkt per rol
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- Lookups: leesbaar voor iedereen (ook uitgelogde marketingpagina's)
grant select on public.cities, public.sports, public.qualifications,
  public.categories to anon, authenticated;

-- Ingelogde gebruikers: lezen via RLS; schrijven waar policies het toelaten
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.instructor_profiles to authenticated;
grant select, insert, delete on public.instructor_statuses to authenticated;
grant select, insert, delete on public.instructor_sports to authenticated;
grant select, insert, delete on public.instructor_qualifications to authenticated;
grant select, insert, update, delete on public.availability_rules to authenticated;
grant select, insert, update, delete on public.availability_exceptions to authenticated;
grant select, insert, update on public.document_uploads to authenticated;
grant select, insert, update on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_locations to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;
grant select, insert, update on public.jobs to authenticated;
grant select, insert, delete on public.job_requirements to authenticated;
grant select on public.job_applications to authenticated;
grant select on public.job_invitations to authenticated;
grant select on public.job_counteroffers to authenticated;
grant select on public.job_confirmations to authenticated;
grant select on public.replacements to authenticated;
grant select on public.cancellations to authenticated;
grant select on public.no_show_records to authenticated;
grant select on public.chats to authenticated;
grant select on public.chat_messages to authenticated;
grant select, update on public.notifications to authenticated;
grant select on public.reviews to authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.billing_events to authenticated;
grant select, insert on public.conversion_fees to authenticated;
grant select, insert on public.admin_notes to authenticated;
grant select on public.settings to authenticated;

-- Admin-mutaties op lookups en beheertabellen lopen via RLS-policies hieronder
grant insert, update, delete on public.cities, public.sports,
  public.qualifications, public.categories to authenticated;
grant update on public.settings to authenticated;
grant update on public.subscriptions to authenticated;
grant insert on public.billing_events to authenticated;
grant update on public.conversion_fees to authenticated;
grant update on public.reviews to authenticated;
grant update on public.cancellations to authenticated;
grant update, delete on public.jobs to authenticated;

-- ---------------------------------------------------------------------------
-- Helperfuncties
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function public.member_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select om.organization_id
  from public.organization_members om
  where om.user_id = auth.uid() and om.state = 'active';
$$;

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members om
    where om.organization_id = target_org
      and om.user_id = auth.uid()
      and om.state = 'active'
  );
$$;

create or replace function public.is_org_owner(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members om
    where om.organization_id = target_org
      and om.user_id = auth.uid()
      and om.state = 'active'
      and om.member_role = 'owner'
  );
$$;

-- Actieve toegang (trial, actief, of binnen hersteltermijn)
create or replace function public.subscription_grants_access(s public.subscriptions)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case
    when s.status = 'trial' then s.trial_ends_at > now()
    when s.status = 'active' then true
    when s.status = 'past_due'
      then coalesce(s.grace_until > now(), false)
    else false
  end;
$$;

create or replace function public.instructor_has_access(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select public.subscription_grants_access(s)
      from public.subscriptions s
      where s.instructor_id = target_user
    ),
    false
  );
$$;

create or replace function public.location_has_access(target_location uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select public.subscription_grants_access(s)
      from public.subscriptions s
      where s.location_id = target_location
    ),
    false
  );
$$;

-- Betrokkenheid bij een opdracht, zonder RLS-recursie tussen jobs en
-- gerelateerde tabellen (security definer omzeilt RLS in de subquery's).
create or replace function public.is_job_participant(target_job uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.job_applications a
    where a.job_id = target_job and a.instructor_id = auth.uid()
  )
  or exists (
    select 1 from public.job_invitations i
    where i.job_id = target_job and i.instructor_id = auth.uid()
  )
  or exists (
    select 1 from public.job_confirmations c
    where c.job_id = target_job and c.instructor_id = auth.uid()
  )
  or exists (
    select 1 from public.replacements r
    where r.job_id = target_job
      and (r.proposed_instructor_id = auth.uid()
        or r.original_instructor_id = auth.uid())
  );
$$;

create or replace function public.job_org(target_job uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select j.organization_id from public.jobs j where j.id = target_job;
$$;

create or replace function public.job_confirmed_instructor(target_job uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.instructor_id
  from public.job_confirmations c
  where c.job_id = target_job;
$$;

grant execute on function public.is_job_participant(uuid) to authenticated;
grant execute on function public.job_org(uuid) to authenticated;
grant execute on function public.job_confirmed_instructor(uuid) to authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.member_org_ids() to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_owner(uuid) to authenticated;
grant execute on function public.instructor_has_access(uuid) to authenticated;
grant execute on function public.location_has_access(uuid) to authenticated;
grant execute on function public.distance_km(
  double precision, double precision, double precision, double precision
) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS inschakelen op alle tabellen
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'cities', 'sports', 'qualifications', 'categories', 'settings',
    'profiles', 'instructor_profiles', 'instructor_statuses',
    'instructor_sports', 'instructor_qualifications', 'availability_rules',
    'availability_exceptions', 'document_uploads', 'organizations',
    'organization_locations', 'organization_members', 'jobs',
    'job_requirements', 'job_applications', 'job_invitations',
    'job_counteroffers', 'job_confirmations', 'replacements', 'cancellations',
    'no_show_records', 'chats', 'chat_messages', 'notifications', 'reviews',
    'subscriptions', 'billing_events', 'conversion_fees', 'admin_notes'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Policies: lookups
-- ---------------------------------------------------------------------------

create policy "lookups leesbaar" on public.cities
  for select using (true);
create policy "cities adminbeheer" on public.cities
  for all using (public.is_admin()) with check (public.is_admin());

create policy "sports leesbaar" on public.sports
  for select using (true);
create policy "sports adminbeheer" on public.sports
  for all using (public.is_admin()) with check (public.is_admin());

create policy "qualifications leesbaar" on public.qualifications
  for select using (true);
create policy "qualifications adminbeheer" on public.qualifications
  for all using (public.is_admin()) with check (public.is_admin());

create policy "categories leesbaar" on public.categories
  for select using (true);
create policy "categories adminbeheer" on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

create policy "settings lezen ingelogd" on public.settings
  for select to authenticated using (true);
create policy "settings adminbeheer" on public.settings
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Policies: profielen
-- ---------------------------------------------------------------------------

-- Profielen zijn zichtbaar voor ingelogde gebruikers (naam, avatar, stad);
-- telefoonnummer/e-mail worden alleen via RPC gedeeld na bevestiging.
create policy "profielen zichtbaar voor ingelogden" on public.profiles
  for select to authenticated using (true);

create policy "eigen profiel aanmaken" on public.profiles
  for insert to authenticated
  with check (id = auth.uid() and role <> 'admin');

create policy "eigen profiel bijwerken" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (
    (id = auth.uid() and role <> 'admin') or public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- Policies: instructeursgegevens
-- ---------------------------------------------------------------------------

create policy "instructeursprofielen zichtbaar" on public.instructor_profiles
  for select to authenticated using (true);

create policy "eigen instructeursprofiel aanmaken" on public.instructor_profiles
  for insert to authenticated with check (user_id = auth.uid());

create policy "eigen instructeursprofiel bijwerken" on public.instructor_profiles
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "statussen zichtbaar" on public.instructor_statuses
  for select to authenticated using (true);
create policy "eigen statussen beheren" on public.instructor_statuses
  for insert to authenticated with check (user_id = auth.uid());
create policy "eigen statussen verwijderen" on public.instructor_statuses
  for delete to authenticated using (user_id = auth.uid());

create policy "specialisaties zichtbaar" on public.instructor_sports
  for select to authenticated using (true);
create policy "eigen specialisaties beheren" on public.instructor_sports
  for insert to authenticated with check (user_id = auth.uid());
create policy "eigen specialisaties verwijderen" on public.instructor_sports
  for delete to authenticated using (user_id = auth.uid());

create policy "kwalificaties zichtbaar" on public.instructor_qualifications
  for select to authenticated using (true);
create policy "eigen kwalificaties beheren" on public.instructor_qualifications
  for insert to authenticated with check (user_id = auth.uid());
create policy "eigen kwalificaties verwijderen" on public.instructor_qualifications
  for delete to authenticated using (user_id = auth.uid());

create policy "beschikbaarheid zichtbaar" on public.availability_rules
  for select to authenticated using (true);
create policy "eigen beschikbaarheid beheren" on public.availability_rules
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "uitzonderingen zichtbaar" on public.availability_exceptions
  for select to authenticated using (true);
create policy "eigen uitzonderingen beheren" on public.availability_exceptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Policies: documenten (alleen eigenaar en admin)
-- ---------------------------------------------------------------------------

create policy "documenten eigenaar en admin" on public.document_uploads
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "documenten uploaden" on public.document_uploads
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

create policy "documenten beoordelen (admin)" on public.document_uploads
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Policies: organisaties
-- ---------------------------------------------------------------------------

create policy "organisaties zichtbaar" on public.organizations
  for select to authenticated using (true);

create policy "organisatie aanmaken" on public.organizations
  for insert to authenticated
  with check (created_by = auth.uid());

create policy "organisatie bijwerken" on public.organizations
  for update to authenticated
  using (public.is_org_owner(id) or public.is_admin())
  with check (public.is_org_owner(id) or public.is_admin());

create policy "vestigingen zichtbaar" on public.organization_locations
  for select to authenticated using (true);

create policy "vestigingen beheren" on public.organization_locations
  for all to authenticated
  using (public.is_org_owner(organization_id) or public.is_admin())
  with check (public.is_org_owner(organization_id) or public.is_admin());

create policy "leden zichtbaar voor org en admin" on public.organization_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_org_member(organization_id)
    or public.is_admin()
    or (invited_email <> '' and lower(invited_email) = lower(auth.email()))
  );

create policy "leden toevoegen" on public.organization_members
  for insert to authenticated
  with check (
    public.is_org_owner(organization_id)
    or public.is_admin()
    -- eerste lid: maker van de organisatie wordt owner
    or (
      user_id = auth.uid()
      and member_role = 'owner'
      and exists (
        select 1 from public.organizations o
        where o.id = organization_id and o.created_by = auth.uid()
      )
    )
    -- uitgenodigd lid accepteert de uitnodiging op eigen e-mailadres
    or (
      user_id = auth.uid()
      and invited_email <> ''
      and lower(invited_email) = lower(auth.email())
    )
  );

create policy "leden bijwerken" on public.organization_members
  for update to authenticated
  using (
    public.is_org_owner(organization_id)
    or public.is_admin()
    or (invited_email <> '' and lower(invited_email) = lower(auth.email()))
  )
  with check (
    public.is_org_owner(organization_id)
    or public.is_admin()
    or (user_id = auth.uid() and lower(invited_email) = lower(auth.email()))
  );

create policy "leden verwijderen" on public.organization_members
  for delete to authenticated
  using (public.is_org_owner(organization_id) or public.is_admin());

-- ---------------------------------------------------------------------------
-- Policies: opdrachten
-- ---------------------------------------------------------------------------

-- Open opdrachten zijn zichtbaar voor alle ingelogden; organisaties zien hun
-- eigen opdrachten in elke status; betrokken instructeurs zien hun opdracht.
create policy "opdrachten zichtbaar" on public.jobs
  for select to authenticated
  using (
    status = 'open'
    or public.is_org_member(organization_id)
    or public.is_admin()
    or public.is_job_participant(id)
  );

create policy "opdracht plaatsen" on public.jobs
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.is_org_member(organization_id)
    and public.location_has_access(location_id)
  );

create policy "opdracht bijwerken" on public.jobs
  for update to authenticated
  using (public.is_org_member(organization_id) or public.is_admin())
  with check (public.is_org_member(organization_id) or public.is_admin());

create policy "opdracht verwijderen (admin)" on public.jobs
  for delete to authenticated using (public.is_admin());

create policy "eisen zichtbaar" on public.job_requirements
  for select to authenticated using (true);

create policy "eisen beheren" on public.job_requirements
  for insert to authenticated
  with check (
    exists (
      select 1 from public.jobs j
      where j.id = job_id
        and (public.is_org_member(j.organization_id) or public.is_admin())
    )
  );

create policy "eisen verwijderen" on public.job_requirements
  for delete to authenticated
  using (
    exists (
      select 1 from public.jobs j
      where j.id = job_id
        and (public.is_org_member(j.organization_id) or public.is_admin())
    )
  );

-- Reacties: zichtbaar voor de instructeur zelf, de organisatie en admin.
create policy "reacties zichtbaar" on public.job_applications
  for select to authenticated
  using (
    instructor_id = auth.uid()
    or public.is_admin()
    or public.is_org_member(public.job_org(job_id))
  );

create policy "uitnodigingen zichtbaar" on public.job_invitations
  for select to authenticated
  using (
    instructor_id = auth.uid()
    or public.is_admin()
    or public.is_org_member(public.job_org(job_id))
  );

create policy "tegenvoorstellen zichtbaar" on public.job_counteroffers
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.job_applications a
      where a.id = application_id
        and (
          a.instructor_id = auth.uid()
          or public.is_org_member(public.job_org(a.job_id))
        )
    )
  );

create policy "bevestigingen zichtbaar" on public.job_confirmations
  for select to authenticated
  using (
    instructor_id = auth.uid()
    or public.is_admin()
    or public.is_org_member(public.job_org(job_id))
  );

-- ---------------------------------------------------------------------------
-- Policies: vervanging, annulering, no-show (mutaties via RPC's)
-- ---------------------------------------------------------------------------

create policy "vervangingen zichtbaar" on public.replacements
  for select to authenticated
  using (
    original_instructor_id = auth.uid()
    or proposed_instructor_id = auth.uid()
    or public.is_admin()
    or public.is_org_member(public.job_org(job_id))
  );

create policy "annuleringen zichtbaar" on public.cancellations
  for select to authenticated
  using (
    cancelled_by = auth.uid()
    or public.is_admin()
    or public.is_org_member(public.job_org(job_id))
    or public.job_confirmed_instructor(job_id) = auth.uid()
  );

create policy "annuleringen corrigeren (admin)" on public.cancellations
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "no-shows zichtbaar" on public.no_show_records
  for select to authenticated
  using (
    instructor_id = auth.uid()
    or public.is_admin()
    or public.is_org_member(public.job_org(job_id))
  );

-- ---------------------------------------------------------------------------
-- Policies: chat (alleen deelnemers)
-- ---------------------------------------------------------------------------

create policy "chats voor deelnemers" on public.chats
  for select to authenticated
  using (
    instructor_id = auth.uid()
    or public.is_org_member(organization_id)
    or public.is_admin()
  );

create policy "chatberichten voor deelnemers" on public.chat_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.chats c
      where c.id = chat_id
        and (
          c.instructor_id = auth.uid()
          or public.is_org_member(c.organization_id)
          or public.is_admin()
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Policies: notificaties (alleen eigenaar)
-- ---------------------------------------------------------------------------

create policy "eigen notificaties lezen" on public.notifications
  for select to authenticated using (user_id = auth.uid());

create policy "eigen notificaties bijwerken" on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Policies: reviews
-- ---------------------------------------------------------------------------

-- Vrijgegeven reviews zijn zichtbaar; eigen (nog niet vrijgegeven) review ook.
create policy "reviews zichtbaar" on public.reviews
  for select to authenticated
  using (
    released_at is not null
    or reviewer_id = auth.uid()
    or public.is_admin()
  );

create policy "reviews beheren (admin)" on public.reviews
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Policies: abonnementen en billing
-- ---------------------------------------------------------------------------

create policy "abonnementen zichtbaar" on public.subscriptions
  for select to authenticated
  using (
    instructor_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.organization_locations l
      where l.id = location_id and public.is_org_member(l.organization_id)
    )
  );

create policy "abonnementen beheren (admin)" on public.subscriptions
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "billing events zichtbaar" on public.billing_events
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.subscriptions s
      where s.id = subscription_id
        and (
          s.instructor_id = auth.uid()
          or exists (
            select 1 from public.organization_locations l
            where l.id = s.location_id
              and public.is_org_member(l.organization_id)
          )
        )
    )
  );

create policy "billing events schrijven (admin)" on public.billing_events
  for insert to authenticated with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Policies: conversievergoeding
-- ---------------------------------------------------------------------------

create policy "conversievergoedingen zichtbaar" on public.conversion_fees
  for select to authenticated
  using (
    instructor_id = auth.uid()
    or public.is_org_member(organization_id)
    or public.is_admin()
  );

create policy "conversievergoeding melden" on public.conversion_fees
  for insert to authenticated
  with check (
    reported_by = auth.uid()
    and status = 'reported'
    and (public.is_org_member(organization_id) or public.is_admin())
  );

create policy "conversievergoeding beheren (admin)" on public.conversion_fees
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Policies: adminnotities
-- ---------------------------------------------------------------------------

create policy "adminnotities alleen admin" on public.admin_notes
  for select to authenticated using (public.is_admin());

create policy "adminnotities schrijven" on public.admin_notes
  for insert to authenticated
  with check (public.is_admin() and admin_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage: buckets en policies
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "avatars publiek leesbaar" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "eigen avatar uploaden" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "eigen avatar bijwerken" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "eigen avatar verwijderen" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "documenten lezen (eigenaar/admin)" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

create policy "documenten uploaden (eigenaar)" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "documenten verwijderen (eigenaar/admin)" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );
