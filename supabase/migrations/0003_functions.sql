-- SportMatch ZZP — 0003: RPC's voor alle kernmutaties
-- Alle schrijfacties op het matchingsproces lopen via deze functies zodat
-- toegangscontrole, statusovergangen, systeemberichten en notificaties
-- consistent en atomair zijn.

set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- Interne helpers (geen execute-grant voor eindgebruikers)
-- ---------------------------------------------------------------------------

create or replace function public.internal_notify(
  target uuid, ntype text, title text, body text, href text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, notification_type, title, body, href)
  values (target, ntype, title, body, href);
$$;

create or replace function public.internal_notify_org(
  target_org uuid, ntype text, title text, body text, href text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, notification_type, title, body, href)
  select om.user_id, ntype, title, body, href
  from public.organization_members om
  where om.organization_id = target_org
    and om.state = 'active'
    and om.user_id is not null;
$$;

create or replace function public.internal_ensure_chat(
  p_job uuid, p_instructor uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  chat_id uuid;
  org_id uuid;
begin
  select organization_id into org_id from public.jobs where id = p_job;

  insert into public.chats (job_id, organization_id, instructor_id)
  values (p_job, org_id, p_instructor)
  on conflict (job_id, instructor_id) do nothing;

  select id into chat_id
  from public.chats
  where job_id = p_job and instructor_id = p_instructor;

  return chat_id;
end;
$$;

create or replace function public.internal_system_message(
  p_chat uuid, p_event text, p_body text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.chat_messages (chat_id, sender_id, body, system_event)
  values (p_chat, null, p_body, p_event);

  update public.chats set last_message_at = now() where id = p_chat;
$$;

-- Effectieve starttijd van een opdracht (Europe/Amsterdam)
create or replace function public.internal_job_starts_at(p_job uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select (j.starts_on + j.start_time) at time zone 'Europe/Amsterdam'
  from public.jobs j
  where j.id = p_job;
$$;

-- ---------------------------------------------------------------------------
-- Publieke statistiek: geaggregeerde betrouwbaarheid per instructeur
-- ---------------------------------------------------------------------------

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
  with c as (
    select count(*) as confirmed
    from public.job_confirmations jc
    where jc.instructor_id = target and jc.confirmed_at is not null
  ),
  done as (
    select count(*) as completed
    from public.job_confirmations jc
    join public.jobs j on j.id = jc.job_id
    where jc.instructor_id = target
      and jc.confirmed_at is not null
      and j.status = 'completed'
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
  from c, done, canc, ns, rev;
$$;

grant execute on function public.instructor_public_stats(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Matching: open opdrachten gescoord voor de ingelogde instructeur
-- ---------------------------------------------------------------------------

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
  )
  select
    j.id,
    round(public.distance_km(me.lat, me.lng, jc.lat, jc.lng)::numeric, 1),
    public.distance_km(me.lat, me.lng, jc.lat, jc.lng)
      <= me.travel_distance_km,
    exists (
      select 1 from public.instructor_sports isp
      where isp.user_id = me.user_id and isp.sport_id = j.sport_id
    ),
    coalesce(
      (
        select array_agg(jr.qualification_id)
        from public.job_requirements jr
        where jr.job_id = j.id
          and not exists (
            select 1
            from public.instructor_qualifications iq
            where iq.user_id = me.user_id
              and iq.qualification_id = jr.qualification_id
          )
      ),
      '{}'::uuid[]
    ),
    round(
      (
        -- afstand: dichterbij is beter (max 35 punten)
        greatest(
          0,
          (1 - least(public.distance_km(me.lat, me.lng, jc.lat, jc.lng), 50) / 50)
        ) * 35
        -- specialisatie (25 punten)
        + case when exists (
            select 1 from public.instructor_sports isp
            where isp.user_id = me.user_id and isp.sport_id = j.sport_id
          ) then 25 else 0 end
        -- beoordeling (20 punten; neutraal 12 zonder reviews)
        + coalesce((select avg_rating from stats) / 5 * 20, 12)
        -- ervaring (10 punten)
        + least((select years_experience from me), 10)
        -- no-showpercentage (10 punten, aftrek per no-show)
        + greatest(
            0,
            10 - coalesce((select no_show_count from stats), 0) * 5
          )
      )::numeric,
      0
    )
  from public.jobs j
  join public.organization_locations l on l.id = j.location_id
  join public.cities jc on jc.id = l.city_id
  cross join me
  where j.status = 'open';
$$;

grant execute on function public.open_job_matches() to authenticated;

-- ---------------------------------------------------------------------------
-- Reageren op een opdracht
-- ---------------------------------------------------------------------------

create or replace function public.apply_to_job(
  p_job uuid,
  p_message text default '',
  p_availability_note text default ''
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
begin
  select * into v_job from public.jobs where id = p_job;

  if v_job.id is null or v_job.status <> 'open' then
    raise exception 'Deze opdracht staat niet (meer) open voor reacties.';
  end if;

  if not exists (
    select 1 from public.instructor_profiles ip where ip.user_id = auth.uid()
  ) then
    raise exception 'Alleen instructeurs met een profiel kunnen reageren.';
  end if;

  if not public.instructor_has_access(auth.uid()) then
    raise exception 'Je abonnement of proefperiode is niet actief. Activeer je abonnement om te reageren.';
  end if;

  insert into public.job_applications (job_id, instructor_id, message, availability_note)
  values (p_job, auth.uid(), coalesce(p_message, ''), coalesce(p_availability_note, ''))
  returning id into v_application;

  select full_name into v_name from public.profiles where id = auth.uid();

  v_chat := public.internal_ensure_chat(p_job, auth.uid());
  perform public.internal_system_message(
    v_chat, 'application_created',
    v_name || ' heeft gereageerd op "' || v_job.title || '".'
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

grant execute on function public.apply_to_job(uuid, text, text) to authenticated;

create or replace function public.withdraw_application(p_application uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app public.job_applications;
begin
  select * into v_app from public.job_applications where id = p_application;

  if v_app.id is null or v_app.instructor_id <> auth.uid() then
    raise exception 'Reactie niet gevonden.';
  end if;

  if v_app.status <> 'pending' then
    raise exception 'Alleen openstaande reacties kunnen worden ingetrokken.';
  end if;

  update public.job_applications
  set status = 'withdrawn'
  where id = p_application;
end;
$$;

grant execute on function public.withdraw_application(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Uitnodigen
-- ---------------------------------------------------------------------------

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

  if not public.location_has_access(v_job.location_id) then
    raise exception 'Het abonnement voor deze vestiging is niet actief.';
  end if;

  insert into public.job_invitations (job_id, instructor_id, invited_by, message)
  values (p_job, p_instructor, auth.uid(), coalesce(p_message, ''))
  returning id into v_invitation;

  v_chat := public.internal_ensure_chat(p_job, p_instructor);
  perform public.internal_system_message(
    v_chat, 'invitation_sent',
    'De organisatie heeft een uitnodiging gestuurd voor "' || v_job.title || '".'
  );

  perform public.internal_notify(
    p_instructor, 'invitation_received',
    'Uitnodiging: ' || v_job.title,
    'Een organisatie nodigt je uit voor deze opdracht.',
    '/opdrachten/' || p_job
  );

  return v_invitation;
end;
$$;

grant execute on function public.invite_instructor(uuid, uuid, text) to authenticated;

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

    update public.job_invitations
    set status = 'accepted'
    where id = p_invitation;

    insert into public.job_applications (job_id, instructor_id, message)
    values (v_inv.job_id, auth.uid(), coalesce(p_message, ''))
    on conflict (job_id, instructor_id) do nothing;

    v_chat := public.internal_ensure_chat(v_inv.job_id, auth.uid());
    perform public.internal_system_message(
      v_chat, 'invitation_accepted',
      'De instructeur heeft de uitnodiging geaccepteerd.'
    );
  else
    update public.job_invitations
    set status = 'declined'
    where id = p_invitation;

    v_chat := public.internal_ensure_chat(v_inv.job_id, auth.uid());
    perform public.internal_system_message(
      v_chat, 'invitation_declined',
      'De instructeur heeft de uitnodiging afgeslagen.'
    );
  end if;
end;
$$;

grant execute on function public.respond_invitation(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Tegenvoorstellen
-- ---------------------------------------------------------------------------

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

  select * into v_job from public.jobs where id = v_app.job_id;

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

create or replace function public.respond_counteroffer(
  p_offer uuid, p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

grant execute on function public.respond_counteroffer(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Digitale bevestiging (beide partijen akkoord)
-- ---------------------------------------------------------------------------

-- Stap 1: organisatie kiest een kandidaat en gaat akkoord met de voorwaarden.
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
  if v_app.id is null then
    raise exception 'Reactie niet gevonden.';
  end if;

  select * into v_job from public.jobs where id = v_app.job_id;

  if not public.is_org_member(v_job.organization_id) then
    raise exception 'Geen toegang tot deze opdracht.';
  end if;

  if v_job.status <> 'open' then
    raise exception 'Deze opdracht staat niet meer open.';
  end if;

  if not public.location_has_access(v_job.location_id) then
    raise exception 'Het abonnement voor deze vestiging is niet actief.';
  end if;

  insert into public.job_confirmations
    (job_id, application_id, instructor_id, terms,
     organization_agreed_at, organization_agreed_by)
  values
    (v_job.id, p_application, v_app.instructor_id, coalesce(p_terms, '{}'::jsonb),
     now(), auth.uid())
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
  perform public.internal_system_message(
    v_chat, 'candidate_selected',
    'De organisatie is akkoord met de opdrachtvoorwaarden en wacht op jouw bevestiging.'
  );

  perform public.internal_notify(
    v_app.instructor_id, 'confirmation_requested',
    'Bevestiging gevraagd: ' || v_job.title,
    'De organisatie heeft jou gekozen. Bevestig de opdracht om definitief te worden.',
    '/opdrachten/' || v_job.id
  );

  return v_confirmation;
end;
$$;

grant execute on function public.select_candidate(uuid, jsonb) to authenticated;

-- Stap 2: instructeur bevestigt; daarna is de opdracht definitief.
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

  if v_conf.organization_agreed_at is null then
    raise exception 'De organisatie moet eerst akkoord gaan.';
  end if;

  if v_conf.confirmed_at is not null then
    raise exception 'Deze opdracht is al bevestigd.';
  end if;

  if not public.instructor_has_access(auth.uid()) then
    raise exception 'Je abonnement of proefperiode is niet actief.';
  end if;

  select * into v_job from public.jobs where id = p_job;

  update public.job_confirmations
  set instructor_agreed_at = now(), confirmed_at = now()
  where id = v_conf.id;

  update public.jobs set status = 'confirmed' where id = p_job;

  update public.job_applications
  set status = 'accepted'
  where id = v_conf.application_id;

  update public.job_applications
  set status = 'rejected'
  where job_id = p_job and id <> v_conf.application_id and status = 'pending';

  v_chat := public.internal_ensure_chat(p_job, auth.uid());
  perform public.internal_system_message(
    v_chat, 'job_confirmed',
    'De opdracht is definitief bevestigd. Contactgegevens zijn nu zichtbaar voor beide partijen.'
  );

  perform public.internal_notify_org(
    v_job.organization_id, 'job_confirmed',
    'Opdracht bevestigd: ' || v_job.title,
    'De instructeur heeft de opdracht bevestigd.',
    '/organisatie/opdrachten/' || p_job
  );
end;
$$;

grant execute on function public.confirm_job(uuid) to authenticated;

-- Contactgegevens van de tegenpartij, alleen na definitieve bevestiging.
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
  select * into v_conf from public.job_confirmations where job_id = p_job;
  if v_conf.id is null or v_conf.confirmed_at is null then
    return;
  end if;

  select * into v_job from public.jobs where id = p_job;

  if v_conf.instructor_id = auth.uid() then
    -- instructeur ziet organisatiecontact
    return query
    select o.contact_name, o.contact_email, o.contact_phone,
      'organization'::public.party_side
    from public.organizations o
    where o.id = v_job.organization_id;
  elsif public.is_org_member(v_job.organization_id) then
    return query
    select p.full_name, p.email, p.phone, 'instructor'::public.party_side
    from public.profiles p
    where p.id = v_conf.instructor_id;
  end if;
end;
$$;

grant execute on function public.get_job_contact_details(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Chat versturen
-- ---------------------------------------------------------------------------

create or replace function public.send_chat_message(p_chat uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chat public.chats;
  v_message uuid;
  v_job public.jobs;
begin
  select * into v_chat from public.chats where id = p_chat;
  if v_chat.id is null then
    raise exception 'Chat niet gevonden.';
  end if;

  if coalesce(trim(p_body), '') = '' then
    raise exception 'Een bericht mag niet leeg zijn.';
  end if;

  select * into v_job from public.jobs where id = v_chat.job_id;

  if v_chat.instructor_id = auth.uid() then
    if not public.instructor_has_access(auth.uid()) then
      raise exception 'Je abonnement of proefperiode is niet actief.';
    end if;
  elsif public.is_org_member(v_chat.organization_id) then
    if not public.location_has_access(v_job.location_id) then
      raise exception 'Het abonnement voor deze vestiging is niet actief.';
    end if;
  else
    raise exception 'Je bent geen deelnemer van deze chat.';
  end if;

  insert into public.chat_messages (chat_id, sender_id, body)
  values (p_chat, auth.uid(), trim(p_body))
  returning id into v_message;

  update public.chats set last_message_at = now() where id = p_chat;

  if v_chat.instructor_id = auth.uid() then
    perform public.internal_notify_org(
      v_chat.organization_id, 'chat_message',
      'Nieuw bericht over "' || v_job.title || '"',
      left(trim(p_body), 120),
      '/berichten/' || p_chat
    );
  else
    perform public.internal_notify(
      v_chat.instructor_id, 'chat_message',
      'Nieuw bericht over "' || v_job.title || '"',
      left(trim(p_body), 120),
      '/berichten/' || p_chat
    );
  end if;

  return v_message;
end;
$$;

grant execute on function public.send_chat_message(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Annulering en vervanging
-- ---------------------------------------------------------------------------

create or replace function public.cancel_confirmed_job(
  p_job uuid, p_reason text default ''
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
  v_pct integer;
  v_chat uuid;
begin
  select * into v_job from public.jobs where id = p_job;
  select * into v_conf from public.job_confirmations where job_id = p_job;

  if v_job.id is null or v_job.status <> 'confirmed' or v_conf.confirmed_at is null then
    raise exception 'Alleen bevestigde opdrachten kunnen worden geannuleerd.';
  end if;

  if v_conf.instructor_id = auth.uid() then
    v_side := 'instructor';
  elsif public.is_org_member(v_job.organization_id) then
    v_side := 'organization';
  else
    raise exception 'Geen toegang tot deze opdracht.';
  end if;

  v_hours := extract(epoch from (public.internal_job_starts_at(p_job) - now())) / 3600;

  -- Annulerings-/vervangingsregeling: oplopend percentage naarmate er korter
  -- van tevoren wordt geannuleerd. Registratie; inning loopt buiten het platform.
  v_pct := case
    when v_hours < 2 then 100
    when v_hours < 6 then 50
    when v_hours < 12 then 25
    else 0
  end;

  insert into public.cancellations
    (job_id, cancelled_by, side, reason, hours_before_start, compensation_pct,
     compensation_note)
  values
    (p_job, auth.uid(), v_side, coalesce(p_reason, ''),
     round(v_hours, 2), v_pct,
     case when v_pct > 0
       then 'Volgens de annuleringsregeling wordt ' || v_pct
         || '% van de afgesproken vergoeding rechtstreeks verrekend tussen partijen.'
       else ''
     end);

  update public.jobs set status = 'cancelled' where id = p_job;

  v_chat := public.internal_ensure_chat(p_job, v_conf.instructor_id);
  perform public.internal_system_message(
    v_chat, 'job_cancelled',
    case when v_side = 'instructor'
      then 'De instructeur heeft de opdracht geannuleerd.'
      else 'De organisatie heeft de opdracht geannuleerd.'
    end
    || case when v_pct > 0
      then ' Annuleringsregeling: ' || v_pct || '% van de vergoeding.'
      else ''
    end
  );

  if v_side = 'instructor' then
    perform public.internal_notify_org(
      v_job.organization_id, 'job_cancelled',
      'Opdracht geannuleerd: ' || v_job.title,
      'De instructeur heeft geannuleerd. Bekijk de vervangingsopties.',
      '/organisatie/opdrachten/' || p_job
    );
  else
    perform public.internal_notify(
      v_conf.instructor_id, 'job_cancelled',
      'Opdracht geannuleerd: ' || v_job.title,
      'De organisatie heeft de opdracht geannuleerd.',
      '/opdrachten/' || p_job
    );
  end if;
end;
$$;

grant execute on function public.cancel_confirmed_job(uuid, text) to authenticated;

create or replace function public.propose_replacement(
  p_job uuid, p_replacement uuid, p_reason text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conf public.job_confirmations;
  v_job public.jobs;
  v_id uuid;
  v_chat uuid;
begin
  select * into v_conf from public.job_confirmations where job_id = p_job;

  if v_conf.id is null or v_conf.instructor_id <> auth.uid() then
    raise exception 'Alleen de bevestigde instructeur kan een vervanger voorstellen.';
  end if;

  select * into v_job from public.jobs where id = p_job;
  if v_job.status <> 'confirmed' then
    raise exception 'Alleen bevestigde opdrachten kunnen een vervanger krijgen.';
  end if;

  if not exists (
    select 1 from public.instructor_profiles ip where ip.user_id = p_replacement
  ) then
    raise exception 'De voorgestelde vervanger heeft geen instructeursprofiel.';
  end if;

  if p_replacement = auth.uid() then
    raise exception 'Je kunt jezelf niet als vervanger voorstellen.';
  end if;

  insert into public.replacements
    (job_id, original_instructor_id, proposed_instructor_id, reason)
  values (p_job, auth.uid(), p_replacement, coalesce(p_reason, ''))
  returning id into v_id;

  v_chat := public.internal_ensure_chat(p_job, auth.uid());
  perform public.internal_system_message(
    v_chat, 'replacement_proposed',
    'Er is een vervanger voorgesteld. De organisatie moet de vervanger eerst goedkeuren.'
  );

  perform public.internal_notify_org(
    v_job.organization_id, 'replacement_proposed',
    'Vervanger voorgesteld voor "' || v_job.title || '"',
    'Beoordeel de voorgestelde vervanger.',
    '/organisatie/opdrachten/' || p_job
  );

  return v_id;
end;
$$;

grant execute on function public.propose_replacement(uuid, uuid, text) to authenticated;

create or replace function public.decide_replacement(
  p_replacement uuid, p_approve boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

grant execute on function public.decide_replacement(uuid, boolean) to authenticated;

create or replace function public.record_no_show(p_job uuid, p_note text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_conf public.job_confirmations;
begin
  select * into v_job from public.jobs where id = p_job;
  select * into v_conf from public.job_confirmations where job_id = p_job;

  if v_job.id is null or not public.is_org_member(v_job.organization_id) then
    raise exception 'Geen toegang tot deze opdracht.';
  end if;

  if v_conf.confirmed_at is null then
    raise exception 'Deze opdracht had geen bevestigde instructeur.';
  end if;

  insert into public.no_show_records (job_id, instructor_id, reported_by, note)
  values (p_job, v_conf.instructor_id, auth.uid(), coalesce(p_note, ''));

  perform public.internal_notify(
    v_conf.instructor_id, 'no_show_recorded',
    'No-show geregistreerd',
    'Er is een no-show geregistreerd voor "' || v_job.title
      || '". Neem contact op met de organisatie als dit niet klopt.',
    '/opdrachten/' || p_job
  );
end;
$$;

grant execute on function public.record_no_show(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Afronden en reviews
-- ---------------------------------------------------------------------------

create or replace function public.complete_job(p_job uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_conf public.job_confirmations;
  v_chat uuid;
begin
  select * into v_job from public.jobs where id = p_job;

  if v_job.id is null or not public.is_org_member(v_job.organization_id) then
    raise exception 'Geen toegang tot deze opdracht.';
  end if;

  if v_job.status <> 'confirmed' then
    raise exception 'Alleen bevestigde opdrachten kunnen worden afgerond.';
  end if;

  select * into v_conf from public.job_confirmations where job_id = p_job;

  update public.jobs set status = 'completed' where id = p_job;

  v_chat := public.internal_ensure_chat(p_job, v_conf.instructor_id);
  perform public.internal_system_message(
    v_chat, 'review_available',
    'De opdracht is afgerond. Jullie kunnen elkaar nu beoordelen.'
  );

  perform public.internal_notify(
    v_conf.instructor_id, 'review_available',
    'Beoordeel de samenwerking',
    'De opdracht "' || v_job.title || '" is afgerond. Laat een beoordeling achter.',
    '/opdrachten/' || p_job
  );

  perform public.internal_notify_org(
    v_job.organization_id, 'review_available',
    'Beoordeel de instructeur',
    'De opdracht "' || v_job.title || '" is afgerond. Laat een beoordeling achter.',
    '/organisatie/opdrachten/' || p_job
  );
end;
$$;

grant execute on function public.complete_job(uuid) to authenticated;

create or replace function public.submit_review(p_job uuid, p_rating integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_conf public.job_confirmations;
  v_side public.party_side;
  v_reviewee uuid;
begin
  select * into v_job from public.jobs where id = p_job;
  select * into v_conf from public.job_confirmations where job_id = p_job;

  if v_job.id is null or v_job.status <> 'completed' or v_conf.id is null then
    raise exception 'Alleen afgeronde opdrachten kunnen worden beoordeeld.';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Een beoordeling is 1 tot en met 5 sterren.';
  end if;

  if v_conf.instructor_id = auth.uid() then
    v_side := 'instructor';
    -- instructeur beoordeelt de organisatie via de contactpersoon/aanmaker
    v_reviewee := v_job.created_by;
  elsif public.is_org_member(v_job.organization_id) then
    v_side := 'organization';
    v_reviewee := v_conf.instructor_id;
  else
    raise exception 'Alleen betrokkenen kunnen beoordelen.';
  end if;

  insert into public.reviews (job_id, reviewer_id, reviewee_id, side, rating)
  values (p_job, auth.uid(), v_reviewee, v_side, p_rating);
end;
$$;

grant execute on function public.submit_review(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Billing (mock)
-- ---------------------------------------------------------------------------

create or replace function public.mock_activate_subscription(p_subscription uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
  v_allowed boolean;
begin
  select * into v_sub from public.subscriptions where id = p_subscription;
  if v_sub.id is null then
    raise exception 'Abonnement niet gevonden.';
  end if;

  v_allowed := v_sub.instructor_id = auth.uid()
    or (
      v_sub.location_id is not null
      and exists (
        select 1 from public.organization_locations l
        where l.id = v_sub.location_id
          and public.is_org_owner(l.organization_id)
      )
    )
    or public.is_admin();

  if not v_allowed then
    raise exception 'Geen toegang tot dit abonnement.';
  end if;

  update public.subscriptions
  set status = 'active',
      current_period_end = now() + interval '1 month',
      grace_until = null,
      cancelled_at = null
  where id = p_subscription;

  insert into public.billing_events (subscription_id, event_type, payload, created_by)
  values (p_subscription, 'mock_payment_succeeded',
    jsonb_build_object('note', 'Mockbetaling; geen echte transactie.'), auth.uid());
end;
$$;

grant execute on function public.mock_activate_subscription(uuid) to authenticated;

create or replace function public.cancel_subscription(p_subscription uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
  v_allowed boolean;
begin
  select * into v_sub from public.subscriptions where id = p_subscription;
  if v_sub.id is null then
    raise exception 'Abonnement niet gevonden.';
  end if;

  v_allowed := v_sub.instructor_id = auth.uid()
    or (
      v_sub.location_id is not null
      and exists (
        select 1 from public.organization_locations l
        where l.id = v_sub.location_id
          and public.is_org_owner(l.organization_id)
      )
    )
    or public.is_admin();

  if not v_allowed then
    raise exception 'Geen toegang tot dit abonnement.';
  end if;

  update public.subscriptions
  set status = 'cancelled', cancelled_at = now()
  where id = p_subscription;

  insert into public.billing_events (subscription_id, event_type, payload, created_by)
  values (p_subscription, 'subscription_cancelled', '{}'::jsonb, auth.uid());
end;
$$;

grant execute on function public.cancel_subscription(uuid) to authenticated;

create or replace function public.admin_set_subscription_status(
  p_subscription uuid,
  p_status public.subscription_status,
  p_grace_days integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Alleen admins kunnen billingstatus wijzigen.';
  end if;

  update public.subscriptions
  set status = p_status,
      grace_until = case
        when p_status = 'past_due'
          then now() + make_interval(days => coalesce(p_grace_days, 14))
        else null
      end,
      current_period_end = case
        when p_status = 'active' then now() + interval '1 month'
        else current_period_end
      end
  where id = p_subscription;

  insert into public.billing_events (subscription_id, event_type, payload, created_by)
  values (p_subscription, 'admin_status_change',
    jsonb_build_object('status', p_status), auth.uid());
end;
$$;

grant execute on function public.admin_set_subscription_status(
  uuid, public.subscription_status, integer
) to authenticated;

-- ---------------------------------------------------------------------------
-- Documentstatussen verversen (verlopen certificaten markeren)
-- ---------------------------------------------------------------------------

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
    and expires_at < current_date;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.refresh_document_statuses() to authenticated;
