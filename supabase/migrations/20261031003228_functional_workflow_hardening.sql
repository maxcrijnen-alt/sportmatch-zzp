-- Enforce the same negotiation rules for UI actions and direct RPC requests.
-- Existing ownership, demo isolation, subscription checks and grants remain.
create or replace function public.create_counteroffer(
  p_application uuid,
  p_pay_type public.pay_type,
  p_amount_cents integer,
  p_message text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app public.job_applications;
  v_job public.jobs;
  v_side public.party_side;
  v_offer uuid;
  v_chat uuid;
begin
  select * into v_app from public.job_applications where id = p_application;
  if v_app.id is null then
    raise exception 'Reactie niet gevonden.';
  end if;

  select * into v_job from public.jobs where id = v_app.job_id for update;

  if v_app.instructor_id = auth.uid() then
    v_side := 'instructor';
    if not public.instructor_has_access(auth.uid()) then
      raise exception 'Je abonnement of proefperiode is niet actief.';
    end if;
  elsif public.is_org_member(v_job.organization_id) then
    v_side := 'organization';
    if not public.location_has_access(v_job.location_id) then
      raise exception 'Het abonnement voor deze vestiging is niet actief.';
    end if;
  else
    raise exception 'Geen toegang tot deze reactie.';
  end if;

  if v_job.status <> 'open' then
    raise exception 'Deze opdracht staat niet meer open.';
  end if;

  if not v_job.pay_is_negotiable then
    raise exception 'De vergoeding van deze opdracht is niet onderhandelbaar.';
  end if;
  if v_app.status <> 'pending' or exists (
    select 1 from public.job_confirmations c where c.application_id = v_app.id
  ) or exists (
    select 1 from public.job_segment_confirmations c
    where c.application_id = v_app.id and c.cancelled_at is null
  ) then
    raise exception 'Deze reactie is niet meer beschikbaar voor tegenvoorstellen.';
  end if;
  if p_pay_type is null or p_pay_type not in ('hourly', 'fixed') then
    raise exception 'Kies een uurtarief of een vast bedrag.';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'Een tegenvoorstel heeft een geldig bedrag nodig.';
  end if;

  insert into public.job_counteroffers
    (application_id, created_by, side, pay_type, amount_cents, message)
  values
    (p_application, auth.uid(), v_side, p_pay_type, p_amount_cents,
     coalesce(p_message, ''))
  returning id into v_offer;

  v_chat := public.internal_ensure_chat(v_app.job_id, v_app.instructor_id);
  perform public.internal_system_message(
    v_chat, 'counteroffer_created',
    'Tegenvoorstel ontvangen: ' || (p_amount_cents / 100.0)::numeric(10,2) || ' euro ('
      || case p_pay_type when 'hourly' then 'per uur' else 'vast bedrag' end || ').'
  );

  if v_side = 'instructor' then
    perform public.internal_notify_org(
      v_job.organization_id, 'counteroffer_received',
      'Tegenvoorstel voor "' || v_job.title || '"',
      'Er is een tegenvoorstel gedaan op een reactie.',
      '/organisatie/opdrachten/' || v_job.id
    );
  else
    perform public.internal_notify(
      v_app.instructor_id, 'counteroffer_received',
      'Tegenvoorstel voor "' || v_job.title || '"',
      'De organisatie heeft een tegenvoorstel gedaan.',
      '/opdrachten/' || v_job.id
    );
  end if;

  return v_offer;
end;
$$;

grant execute on function public.create_counteroffer(uuid, public.pay_type, integer, text)
  to authenticated;


CREATE OR REPLACE FUNCTION public.respond_counteroffer(p_offer uuid, p_accept boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_offer public.job_counteroffers;
  v_app public.job_applications;
  v_job public.jobs;
  v_chat uuid;
begin
  select * into v_offer from public.job_counteroffers where id = p_offer;
  if v_offer.id is null then
    raise exception 'Tegenvoorstel niet gevonden.';
  end if;

  select * into v_app from public.job_applications where id = v_offer.application_id;
  select * into v_job from public.jobs where id = v_app.job_id for update;

  -- de tegenpartij beantwoordt het voorstel
  if v_offer.side = 'instructor' then
    if not public.is_org_member(v_job.organization_id) then
      raise exception 'Geen toegang.';
    end if;
  else
    if v_app.instructor_id <> auth.uid() then
      raise exception 'Geen toegang.';
    end if;
  end if;

  if v_job.status <> 'open' then
    raise exception 'Deze opdracht staat niet meer open voor tegenvoorstellen.';
  end if;
  if not v_job.pay_is_negotiable then
    raise exception 'De vergoeding van deze opdracht is niet onderhandelbaar.';
  end if;
  if v_app.status <> 'pending' or exists (
    select 1 from public.job_confirmations c where c.application_id = v_app.id
  ) or exists (
    select 1 from public.job_segment_confirmations c
    where c.application_id = v_app.id and c.cancelled_at is null
  ) then
    raise exception 'Deze reactie is niet meer beschikbaar voor tegenvoorstellen.';
  end if;
  if p_accept is null then raise exception 'Kies accepteren of afwijzen.'; end if;
  if v_offer.status <> 'pending' then
    raise exception 'Dit tegenvoorstel is al beantwoord.';
  end if;

  update public.job_counteroffers
  set status = case when p_accept then 'accepted' else 'rejected' end::public.counteroffer_status
  where id = p_offer;

  v_chat := public.internal_ensure_chat(v_app.job_id, v_app.instructor_id);
  perform public.internal_system_message(
    v_chat,
    case when p_accept then 'counteroffer_accepted' else 'counteroffer_rejected' end,
    case when p_accept
      then 'Het tegenvoorstel is geaccepteerd.'
      else 'Het tegenvoorstel is afgewezen.'
    end
  );
end;
$function$;

-- VOG expiry is a Dutch calendar date, independent of the database session zone.
create or replace function private.has_valid_vog(target_user uuid)
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
      and (d.expires_at is null or d.expires_at >= (now() at time zone 'Europe/Amsterdam')::date)
  );
$$;
revoke all on function private.has_valid_vog(uuid) from public, anon, authenticated;

create or replace function public.refresh_document_statuses()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Alleen admins kunnen documentstatussen verversen.';
  end if;

  update public.document_uploads
  set status = 'expired'
  where status = 'approved'
    and expires_at is not null
    and expires_at < (now() at time zone 'Europe/Amsterdam')::date;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- A withdrawn/rejected application cannot be revived by a direct selection RPC.
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
  if v_app.status <> 'pending' then
    raise exception 'Deze reactie is niet meer beschikbaar voor selectie.';
  end if;
  if v_job.status <> 'open' then raise exception 'Deze opdracht staat niet meer open.'; end if;
  if private.has_pending_review(auth.uid()) then
    raise exception 'Je hebt nog een beoordeling openstaan. Rond die eerst af.';
  end if;
  if not private.has_valid_vog(v_app.instructor_id) then
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

-- A withdrawn/rejected application cannot be revived by a direct selection RPC.
CREATE OR REPLACE FUNCTION public.select_candidate_segments(p_application uuid, p_segment_ids uuid[], p_terms jsonb DEFAULT '{}'::jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if v_app.status <> 'pending' then
    raise exception 'Deze reactie is niet meer beschikbaar voor selectie.';
  end if;
  if v_job.status <> 'open' then raise exception 'Dit lessenblok staat niet meer open.'; end if;
  if private.has_pending_review(auth.uid()) then
    raise exception 'Je hebt nog een beoordeling openstaan. Rond die eerst af.';
  end if;
  if not private.has_valid_vog(v_app.instructor_id) then
    raise exception 'Deze kandidaat heeft geen goedgekeurde, geldige VOG.';
  end if;
  if not public.location_has_access(v_job.location_id) then
    raise exception 'Het abonnement voor deze vestiging is niet actief.';
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
$function$;
