-- Private organization rosters. No remote connections, credentials or data imports.
alter table public.organization_locations add constraint agenda_location_org_key unique(id, organization_id);
-- Enforce organization/location identity for new job writes as well as the
-- new RPC. Existing rows are not rewritten; audit/validate them in staging.
-- Replace the single-column FK atomically rather than adding a second
-- relationship: existing PostgREST location embeds must remain unambiguous.
alter table public.jobs drop constraint jobs_location_id_fkey,
  add constraint jobs_location_organization_fk
  foreign key(location_id, organization_id) references public.organization_locations(id, organization_id)
  on delete cascade not valid;

create table public.agenda_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null,
  provider text not null check (provider in ('manual','synthetic')),
  enabled boolean not null default true,
  anchor_date date not null,
  version integer not null default 0,
  last_synced_at timestamptz,
  sync_status text not null default 'never' check (sync_status in ('never','success','failed')),
  last_error text check (last_error in ('invalid_schedule')),
  lesson_count integer not null default 0,
  unique(location_id, provider),
  unique(id, organization_id, location_id),
  foreign key(location_id, organization_id) references public.organization_locations(id, organization_id) on delete cascade
);

create table public.scheduled_lessons (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null,
  organization_id uuid not null,
  location_id uuid not null,
  external_id text not null check (length(external_id) between 1 and 120),
  title text not null check (length(title) between 2 and 120),
  sport_id uuid not null references public.sports(id),
  lesson_type text not null check (length(lesson_type) between 2 and 100),
  starts_on date not null,
  start_time time not null,
  end_time time not null,
  instructor_label text not null default '' check (length(instructor_label) <= 80),
  needs_substitute boolean not null default false,
  cancelled boolean not null default false,
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  check (start_time < end_time),
  unique(source_id, external_id),
  foreign key(source_id, organization_id, location_id) references public.agenda_sources(id, organization_id, location_id) on delete cascade,
  foreign key(location_id, organization_id) references public.organization_locations(id, organization_id) on delete cascade
);
create index scheduled_lessons_org_date_idx on public.scheduled_lessons(organization_id, starts_on);
create index scheduled_lessons_location_date_idx on public.scheduled_lessons(location_id, starts_on);
-- One occurrence has at most one replacement search, including closed searches.
-- Source updates cannot change previously published/agreed job terms.
create table public.lesson_replacement_jobs (
  lesson_id uuid primary key references public.scheduled_lessons(id) on delete cascade,
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  lesson_revision integer not null,
  created_at timestamptz not null default now()
);

create function private.can_manage_agenda(p_organization uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    join public.profiles p on p.id=m.user_id
    join public.organizations o on o.id=m.organization_id
    where m.organization_id=p_organization and m.user_id=auth.uid()
      and m.state='active' and p.role='organization'
      and p.demo_session_id is not distinct from o.demo_session_id
  );
$$;
revoke all on function private.can_manage_agenda(uuid) from public, anon;
grant execute on function private.can_manage_agenda(uuid) to authenticated;

alter table public.agenda_sources enable row level security;
alter table public.scheduled_lessons enable row level security;
alter table public.lesson_replacement_jobs enable row level security;
revoke all on public.agenda_sources, public.scheduled_lessons, public.lesson_replacement_jobs from anon, authenticated;
grant select on public.agenda_sources, public.scheduled_lessons, public.lesson_replacement_jobs to authenticated;
grant all on public.agenda_sources, public.scheduled_lessons, public.lesson_replacement_jobs to service_role;
create policy "own organization sources" on public.agenda_sources for select to authenticated
  using (private.can_manage_agenda(organization_id));
create policy "own organization lessons" on public.scheduled_lessons for select to authenticated
  using (private.can_manage_agenda(organization_id));
create policy "own lesson replacement links" on public.lesson_replacement_jobs for select to authenticated
  using (exists(select 1 from public.scheduled_lessons l where l.id=lesson_id));

-- This is a normalized internal contract, not an external vendor API or file importer.
-- Manual edits use occurrence revisions; sync uses a source version. Both serialize
-- on the source row, preventing stale imports from overwriting newer information.
create function private.save_agenda_lessons(
  p_location uuid, p_provider text, p_anchor date, p_version integer,
  p_enabled boolean, p_lessons jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid; v_source public.agenda_sources; v_lesson public.scheduled_lessons;
  v_item jsonb; v_id uuid; v_date date; v_start time; v_end time; v_count integer := 0;
begin
  select organization_id into v_org from public.organization_locations where id=p_location;
  if not coalesce(private.can_manage_agenda(v_org),false) then
    raise exception using errcode='42501', message='Geen toegang tot dit lesrooster.';
  end if;
  if p_provider not in ('manual','synthetic') or p_provider is null or p_enabled is null
    or (p_provider='manual' and not p_enabled)
    or p_anchor is null or p_anchor < (now() at time zone 'Europe/Amsterdam')::date - 366
    or p_anchor > (now() at time zone 'Europe/Amsterdam')::date + 730 then
    raise exception 'Ongeldige roosterbron.';
  end if;
  if p_provider='synthetic' and not public.is_org_owner(v_org) then
    raise exception using errcode='42501', message='Alleen een eigenaar beheert voorbeeldkoppelingen.';
  end if;
  insert into public.agenda_sources(organization_id,location_id,provider,anchor_date)
    values(v_org,p_location,p_provider,p_anchor) on conflict(location_id,provider) do nothing;
  select * into v_source from public.agenda_sources where location_id=p_location and provider=p_provider for update;
  if p_provider='synthetic' and (p_version is distinct from v_source.version or p_anchor<>v_source.anchor_date) then
    raise exception 'Het rooster is ondertussen gewijzigd. Vernieuw de pagina.';
  end if;
  begin
    if jsonb_typeof(p_lessons) is distinct from 'array' or jsonb_array_length(p_lessons)>104
      or (p_enabled and jsonb_array_length(p_lessons)=0) or pg_column_size(p_lessons)>200000 then
      raise exception 'Ongeldig lesrooster.';
    end if;
    if exists(select 1 from jsonb_array_elements(p_lessons) e group by e->>'externalId' having count(*)>1) then
      raise exception 'Dubbele lesidentiteit in het rooster.';
    end if;
    for v_item in select value from jsonb_array_elements(p_lessons) loop
      if jsonb_typeof(v_item) <> 'object' or exists(select 1 from jsonb_object_keys(v_item) k
        where k not in ('externalId','revision','title','sportId','lessonType','date','startTime','endTime','instructor','needsSubstitute','cancelled')) then
        raise exception 'Onbekende roostervelden.';
      end if;
      v_date := (v_item->>'date')::date;
      v_start := (v_item->>'startTime')::time; v_end := (v_item->>'endTime')::time;
      if v_date is null or v_start is null or v_end is null or v_start>=v_end
        or v_date < (now() at time zone 'Europe/Amsterdam')::date - 366
        or v_date > (now() at time zone 'Europe/Amsterdam')::date + 730
        or v_start >= '24:00'::time or v_end >= '24:00'::time
        or (((v_date+v_start) at time zone 'Europe/Amsterdam') at time zone 'Europe/Amsterdam') <> v_date+v_start
        or (((v_date+v_end) at time zone 'Europe/Amsterdam') at time zone 'Europe/Amsterdam') <> v_date+v_end
        or not exists(select 1 from public.sports where id=(v_item->>'sportId')::uuid and is_active) then
        raise exception 'Controleer datum, tijden en sport.';
      end if;
      select * into v_lesson from public.scheduled_lessons
        where source_id=v_source.id and external_id=v_item->>'externalId' for update;
      if p_provider='manual' and (
          (v_lesson.id is not null and (v_item->>'revision')::integer is distinct from v_lesson.revision)
          or (v_lesson.id is null and (v_item->>'revision')::integer is distinct from 0)) then
        raise exception 'Deze les is ondertussen gewijzigd. Vernieuw de pagina.';
      end if;
      insert into public.scheduled_lessons as l(source_id,organization_id,location_id,external_id,
        title,sport_id,lesson_type,starts_on,start_time,end_time,instructor_label,needs_substitute,cancelled)
      values(v_source.id,v_org,p_location,v_item->>'externalId',btrim(v_item->>'title'),
        (v_item->>'sportId')::uuid,btrim(v_item->>'lessonType'),v_date,v_start,v_end,
        btrim(coalesce(v_item->>'instructor','')),(v_item->>'needsSubstitute')::boolean,(v_item->>'cancelled')::boolean)
      on conflict(source_id,external_id) do update set
        title=excluded.title,sport_id=excluded.sport_id,lesson_type=excluded.lesson_type,
        starts_on=excluded.starts_on,start_time=excluded.start_time,end_time=excluded.end_time,
        instructor_label=excluded.instructor_label,needs_substitute=excluded.needs_substitute,
        cancelled=excluded.cancelled,revision=l.revision+1,updated_at=now()
      where (l.title,l.sport_id,l.lesson_type,l.starts_on,l.start_time,l.end_time,l.instructor_label,l.needs_substitute,l.cancelled)
        is distinct from (excluded.title,excluded.sport_id,excluded.lesson_type,excluded.starts_on,excluded.start_time,excluded.end_time,excluded.instructor_label,excluded.needs_substitute,excluded.cancelled)
      returning id into v_id;
      if v_id is not null then v_count := v_count+1; end if;
    end loop;
    -- Synthetic feeds are complete snapshots of a fixed four-week window.
    -- Missing occurrences become cancelled, never deleted or recreated.
    if p_provider='synthetic' and p_enabled then
      update public.scheduled_lessons l set cancelled=true,revision=revision+1,updated_at=now()
      where l.source_id=v_source.id and not l.cancelled
        and not exists(select 1 from jsonb_array_elements(p_lessons) e where e->>'externalId'=l.external_id);
    end if;
    update public.agenda_sources set enabled=p_enabled,version=version+1,last_synced_at=now(),
      sync_status='success',last_error=null,lesson_count=(select count(*) from public.scheduled_lessons where source_id=v_source.id and not cancelled)
      where id=v_source.id;
  exception when others then
    if p_provider='manual' then raise; end if;
    update public.agenda_sources set version=version+1,sync_status='failed',last_error='invalid_schedule' where id=v_source.id;
    return jsonb_build_object('ok',false,'error','invalid_schedule');
  end;
  return jsonb_build_object('ok',true,'sourceId',v_source.id,'changed',v_count);
end;
$$;
revoke all on function private.save_agenda_lessons(uuid,text,date,integer,boolean,jsonb) from public, anon;
grant execute on function private.save_agenda_lessons(uuid,text,date,integer,boolean,jsonb) to authenticated;
create function public.save_agenda_lessons(p_location uuid,p_provider text,p_anchor date,p_version integer,p_enabled boolean,p_lessons jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.save_agenda_lessons(p_location,p_provider,p_anchor,p_version,p_enabled,p_lessons);
$$;
revoke all on function public.save_agenda_lessons(uuid,text,date,integer,boolean,jsonb) from public, anon;
grant execute on function public.save_agenda_lessons(uuid,text,date,integer,boolean,jsonb) to authenticated;

create function private.create_lesson_replacement(p_lesson uuid,p_revision integer,p_terms jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_lesson public.scheduled_lessons; v_source public.agenda_sources;
  v_job uuid; v_demo uuid; v_rate integer; v_amount integer; v_qual uuid;
begin
  select * into v_lesson from public.scheduled_lessons where id=p_lesson for update;
  if not coalesce(private.can_manage_agenda(v_lesson.organization_id),false) then
    raise exception using errcode='42501', message='Geen toegang tot deze les.';
  end if;
  -- Return the original job on double click/retry, even if the source changed.
  select job_id into v_job from public.lesson_replacement_jobs where lesson_id=p_lesson;
  if v_job is not null then return v_job; end if;
  select * into v_source from public.agenda_sources where id=v_lesson.source_id;
  if v_source.provider<>'manual' or not v_source.enabled then
    raise exception 'Voorbeeldlessen kunnen geen echte invalopdracht publiceren.';
  end if;
  if p_revision is distinct from v_lesson.revision then
    raise exception 'Deze les is ondertussen gewijzigd. Vernieuw de pagina.';
  end if;
  if v_lesson.cancelled or (v_lesson.starts_on+v_lesson.end_time) at time zone 'Europe/Amsterdam' <= now() then
    raise exception 'Deze les is geannuleerd of al afgelopen.';
  end if;
  if not public.location_has_access(v_lesson.location_id) or private.has_pending_review(auth.uid()) then
    raise exception using errcode='42501', message='Controleer je openstaande beoordeling en de toegang van deze vestiging.';
  end if;
  if jsonb_typeof(p_terms) is distinct from 'object' or pg_column_size(p_terms)>20000
    or length(btrim(coalesce(p_terms->>'title',''))) not between 5 and 150
    or length(btrim(coalesce(p_terms->>'description',''))) not between 10 and 5000
    or length(btrim(coalesce(p_terms->>'contactName',''))) not between 2 and 100
    or p_terms->>'payType' is null or p_terms->>'payType' not in ('fixed','hourly')
    or jsonb_typeof(p_terms->'qualificationIds') is distinct from 'array'
    or jsonb_array_length(p_terms->'qualificationIds')>50
    or length(coalesce(p_terms->>'requiredLevel',''))>100 then
    raise exception 'Controleer de opdrachtgegevens.';
  end if;
  v_rate := (p_terms->>'payHourlyRateCents')::integer;
  v_amount := (p_terms->>'payAmountCents')::integer;
  if (p_terms->>'payType'='hourly' and coalesce(v_rate,0) not between 1 and 10000000)
    or (p_terms->>'payType'='fixed' and coalesce(v_amount,0) not between 1 and 10000000)
    or coalesce((p_terms->>'expectedParticipants')::integer,0) not between 0 and 10000 then
    raise exception 'Ongeldige vergoeding of deelnemersaantal.';
  end if;
  select demo_session_id into v_demo from public.profiles where id=auth.uid();
  insert into public.jobs(organization_id,location_id,created_by,job_type,sport_id,custom_lesson_type,
    title,description,starts_on,start_time,end_time,pay_type,pay_amount_cents,pay_hourly_rate_cents,
    pay_is_negotiable,required_level,expected_participants,contact_name,demo_session_id)
  values(v_lesson.organization_id,v_lesson.location_id,auth.uid(),'urgent_substitute',v_lesson.sport_id,v_lesson.lesson_type,
    btrim(p_terms->>'title'),btrim(p_terms->>'description'),v_lesson.starts_on,v_lesson.start_time,v_lesson.end_time,
    (p_terms->>'payType')::public.pay_type,case when p_terms->>'payType'='fixed' then v_amount end,
    case when p_terms->>'payType'='hourly' then v_rate end,coalesce((p_terms->>'payIsNegotiable')::boolean,false),
    coalesce(p_terms->>'requiredLevel',''),(p_terms->>'expectedParticipants')::integer,btrim(p_terms->>'contactName'),v_demo)
  returning id into v_job;
  for v_qual in select distinct value::uuid from jsonb_array_elements_text(p_terms->'qualificationIds') loop
    if not exists(select 1 from public.qualifications where id=v_qual and is_active) then
      raise exception 'Een diploma-eis is niet beschikbaar.';
    end if;
    insert into public.job_requirements(job_id,qualification_id) values(v_job,v_qual);
  end loop;
  insert into public.lesson_replacement_jobs(lesson_id,job_id,lesson_revision) values(p_lesson,v_job,v_lesson.revision);
  update public.scheduled_lessons set needs_substitute=true where id=p_lesson;
  return v_job;
end;
$$;
revoke all on function private.create_lesson_replacement(uuid,integer,jsonb) from public, anon;
grant execute on function private.create_lesson_replacement(uuid,integer,jsonb) to authenticated;
create function public.create_lesson_replacement(p_lesson uuid,p_revision integer,p_terms jsonb)
returns uuid language sql security invoker set search_path = '' as $$
  select private.create_lesson_replacement(p_lesson,p_revision,p_terms);
$$;
revoke all on function public.create_lesson_replacement(uuid,integer,jsonb) from public, anon;
grant execute on function public.create_lesson_replacement(uuid,integer,jsonb) to authenticated;
