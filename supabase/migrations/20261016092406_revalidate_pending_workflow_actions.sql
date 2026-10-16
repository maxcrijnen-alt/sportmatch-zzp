-- Revalidate authority at the final step, not only when an offer was created.
-- Function bodies preserve existing rules, return values, search_path and grants.
-- No row updates, schema changes or changes to trial durations/prices.

CREATE OR REPLACE FUNCTION public.confirm_job(p_job uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  select * into v_job from public.jobs where id = p_job;
  if v_job.status is distinct from 'open'::public.job_status then
    raise exception 'Deze opdracht staat niet meer open voor bevestiging.';
  end if;
  if not public.instructor_has_access(auth.uid()) then
    raise exception 'Je abonnement of proefperiode is niet actief.';
  end if;
  if not private.has_valid_vog(auth.uid()) then
    raise exception 'Een goedgekeurde, geldige VOG is vereist om definitief te bevestigen.';
  end if;
  if private.has_pending_review(auth.uid()) then
    raise exception 'Je hebt nog een beoordeling openstaan. Rond die eerst af.';
  end if;
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
$function$;

CREATE OR REPLACE FUNCTION public.confirm_job_segments(p_job uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_job public.jobs;
  v_confirmation public.job_segment_confirmations;
  v_count integer := 0;
begin
  select * into v_job from public.jobs where id = p_job;
  if v_job.id is null then raise exception 'Opdracht niet gevonden.'; end if;
  if v_job.status <> 'open' then
    raise exception 'Dit lessenblok staat niet meer open voor bevestiging.';
  end if;
  if not public.instructor_has_access(auth.uid()) then
    raise exception 'Je abonnement of proefperiode is niet actief.';
  end if;
  if not private.has_valid_vog(auth.uid()) then
    raise exception 'Een goedgekeurde, geldige VOG is vereist om definitief te bevestigen.';
  end if;
  if private.has_pending_review(auth.uid()) then
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
$function$;

CREATE OR REPLACE FUNCTION public.respond_invitation(p_invitation uuid, p_accept boolean, p_message text DEFAULT ''::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_inv public.job_invitations;
  v_job public.jobs;
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
    select * into v_job from public.jobs where id = v_inv.job_id;
    if v_job.id is null or v_job.status <> 'open'
      or not public.demo_scope_matches(v_job.demo_session_id) then
      raise exception 'Deze opdracht staat niet meer open voor reacties.';
    end if;
    if not public.instructor_has_access(auth.uid()) then
      raise exception 'Je abonnement of proefperiode is niet actief. Activeer je abonnement om te reageren.';
    end if;
    if not private.has_valid_vog(auth.uid()) then
      raise exception 'Een goedgekeurde, geldige VOG is vereist om een uitnodiging te accepteren.';
    end if;
    if private.has_pending_review(auth.uid()) then
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
$function$;

CREATE OR REPLACE FUNCTION public.decide_replacement(p_replacement uuid, p_approve boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_rep public.replacements;
  v_job public.jobs;
  v_chat uuid;
begin
  select * into v_rep from public.replacements where id = p_replacement;
  if v_rep.id is null then
    raise exception 'Vervangingsvoorstel niet gevonden.';
  end if;

  select * into v_job from public.jobs where id = v_rep.job_id;
  if not public.is_org_member(v_job.organization_id) then
    raise exception 'Alleen de organisatie kan een vervanger beoordelen.';
  end if;

  if v_rep.status <> 'proposed' then
    raise exception 'Dit voorstel is al beoordeeld.';
  end if;

  if p_approve then
    if v_job.status <> 'confirmed' then
      raise exception 'Alleen bevestigde opdrachten kunnen een vervanger krijgen.';
    end if;
    if not private.has_valid_vog(v_rep.proposed_instructor_id) then
      raise exception 'De voorgestelde vervanger heeft geen goedgekeurde, geldige VOG.';
    end if;
  end if;

  update public.replacements
  set status = case when p_approve then 'approved' else 'rejected' end::public.replacement_status,
      decided_by = auth.uid(),
      decided_at = now()
  where id = p_replacement;

  if p_approve then
    update public.job_confirmations
    set instructor_id = v_rep.proposed_instructor_id
    where job_id = v_rep.job_id;
  end if;

  v_chat := public.internal_ensure_chat(v_rep.job_id, v_rep.original_instructor_id);
  perform public.internal_system_message(
    v_chat,
    case when p_approve then 'replacement_approved' else 'replacement_rejected' end,
    case when p_approve
      then 'De vervanger is goedgekeurd door de organisatie.'
      else 'De vervanger is afgewezen door de organisatie.'
    end
  );

  perform public.internal_notify(
    v_rep.original_instructor_id, 'replacement_decided',
    case when p_approve then 'Vervanger goedgekeurd' else 'Vervanger afgewezen' end,
    'Bekijk de opdracht voor de details.',
    '/opdrachten/' || v_rep.job_id
  );

  perform public.internal_notify(
    v_rep.proposed_instructor_id, 'replacement_decided',
    case when p_approve
      then 'Je bent goedgekeurd als vervanger'
      else 'Vervangingsvoorstel afgewezen'
    end,
    'Bekijk de opdracht voor de details.',
    '/opdrachten/' || v_rep.job_id
  );
end;
$function$;

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
  select * into v_job from public.jobs where id = v_app.job_id;

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

