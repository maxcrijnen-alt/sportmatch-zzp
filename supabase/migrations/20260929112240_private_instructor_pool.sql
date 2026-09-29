-- Private instructor pool: one-sided organization connections.
-- Organizations and demo instructors are scoped to the same demo session.

create table public.organization_instructor_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  instructor_id uuid not null references public.instructor_profiles (user_id) on delete cascade,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (organization_id, instructor_id)
);

create index organization_instructor_connections_recent_idx
  on public.organization_instructor_connections (organization_id, created_at desc);
create index organization_instructor_connections_instructor_idx
  on public.organization_instructor_connections (instructor_id);

alter table public.organization_instructor_connections enable row level security;

revoke all on public.organization_instructor_connections from public, anon, authenticated;
grant select, insert, delete on public.organization_instructor_connections to authenticated;

-- An instructor cannot see any pool row, including a row about themselves.
create policy "organisatie leest eigen private poule"
  on public.organization_instructor_connections
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'organization'
    )
    and private.is_org_member(organization_id)
    and private.organization_in_demo_scope(organization_id)
    and private.profile_in_demo_scope(instructor_id)
  );

create policy "organisatie voegt toe aan eigen private poule"
  on public.organization_instructor_connections
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'organization'
    )
    and exists (
      select 1 from public.profiles p
      where p.id = instructor_id and p.role = 'instructor'
    )
    and private.is_org_member(organization_id)
    and private.organization_in_demo_scope(organization_id)
    and private.profile_in_demo_scope(instructor_id)
  );

create policy "organisatie verwijdert uit eigen private poule"
  on public.organization_instructor_connections
  for delete to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'organization'
    )
    and private.is_org_member(organization_id)
    and private.organization_in_demo_scope(organization_id)
    and private.profile_in_demo_scope(instructor_id)
  );

create function public.set_instructor_connection(
  p_organization uuid,
  p_instructor uuid,
  p_connected boolean
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null
    or p_organization is null
    or p_instructor is null
    or p_connected is null
    or not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'organization'
    )
    or not public.is_org_member(p_organization)
    or not private.organization_in_demo_scope(p_organization)
  then
    raise exception 'Geen toegang tot deze organisatie.';
  end if;

  if not exists (
    select 1
    from public.instructor_profiles ip
    join public.profiles p on p.id = ip.user_id
    where ip.user_id = p_instructor
      and p.role = 'instructor'
      and private.profile_in_demo_scope(ip.user_id)
  ) then
    raise exception 'Instructeur niet gevonden.';
  end if;

  if p_connected then
    insert into public.organization_instructor_connections
      (organization_id, instructor_id, created_by)
    values (p_organization, p_instructor, auth.uid())
    on conflict (organization_id, instructor_id) do nothing;
  else
    delete from public.organization_instructor_connections
    where organization_id = p_organization
      and instructor_id = p_instructor;
  end if;

  return p_connected;
end;
$$;

revoke all on function public.set_instructor_connection(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.set_instructor_connection(uuid, uuid, boolean)
  to authenticated;

-- Keep all invitation gates, chat creation and notifications in invite_instructor.
create function public.invite_connected_instructors(
  p_job uuid,
  p_message text default ''
)
returns table (invited_count integer, skipped_count integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_instructor uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'organization'
  ) then
    raise exception 'Geen toegang tot deze opdracht.';
  end if;

  select * into v_job from public.jobs where id = p_job;
  if v_job.id is null
    or not public.is_org_member(v_job.organization_id)
    or not private.organization_in_demo_scope(v_job.organization_id)
    or not public.demo_scope_matches(v_job.demo_session_id)
  then
    raise exception 'Opdracht niet gevonden of geen toegang.';
  end if;
  if v_job.status <> 'open' then
    raise exception 'Alleen open opdrachten kunnen uitnodigingen versturen.';
  end if;

  invited_count := 0;
  skipped_count := 0;

  for v_instructor in
    select c.instructor_id
    from public.organization_instructor_connections c
    where c.organization_id = v_job.organization_id
    order by c.created_at, c.id
  loop
    if exists (
      select 1 from public.job_invitations i
      where i.job_id = p_job and i.instructor_id = v_instructor
    ) or exists (
      select 1 from public.job_applications a
      where a.job_id = p_job and a.instructor_id = v_instructor
    ) or exists (
      select 1 from public.job_confirmations c
      where c.job_id = p_job and c.instructor_id = v_instructor
    ) or exists (
      select 1 from public.job_segment_confirmations c
      where c.job_id = p_job and c.instructor_id = v_instructor
    ) then
      skipped_count := skipped_count + 1;
      continue;
    end if;

    begin
      perform public.invite_instructor(p_job, v_instructor, coalesce(p_message, ''));
      invited_count := invited_count + 1;
    exception
      when unique_violation or raise_exception then
        -- Existing invitation/business gate failed for this instructor only.
        skipped_count := skipped_count + 1;
    end;
  end loop;

  return next;
end;
$$;

revoke all on function public.invite_connected_instructors(uuid, text)
  from public, anon, authenticated;
grant execute on function public.invite_connected_instructors(uuid, text)
  to authenticated;
