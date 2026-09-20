-- Functionele smoketest van de kernflows, uitgevoerd als 'authenticated'.
\set ON_ERROR_STOP on

-- Testgebruikers aanmaken (triggert handle_new_user)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'instructeur@test.nl',
   '{"role": "instructor", "full_name": "Iris Instructeur"}'),
  ('00000000-0000-0000-0000-000000000002', 'sportschool@test.nl',
   '{"role": "organization", "full_name": "Otto Organisatie"}'),
  ('00000000-0000-0000-0000-000000000003', 'vervanger@test.nl',
   '{"role": "instructor", "full_name": "Vera Vervanger"}'),
  ('00000000-0000-0000-0000-000000000009', 'admin@test.nl',
   '{"role": "instructor", "full_name": "Adam Admin"}');

-- admin-rol kan alleen via service_role/SQL worden gezet (zelfregistratie blokkeert dit)
update public.profiles set role = 'admin'
  where id = '00000000-0000-0000-0000-000000000009';

do $$
begin
  if (select count(*) from public.profiles where id in (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000009'
  )) <> 4 then
    raise exception 'FAIL: profielen niet automatisch aangemaakt';
  end if;
  if (select role from public.profiles where id = '00000000-0000-0000-0000-000000000001') <> 'instructor' then
    raise exception 'FAIL: instructeursrol niet gezet';
  end if;
end $$;

-- ===== Instructeur vult profiel in (als authenticated) =====
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select set_config('request.jwt.claim.email', 'instructeur@test.nl', false);

update public.profiles
set phone = '0612345678',
    city_id = (select id from public.cities where name = 'Utrecht')
where id = auth.uid();

insert into public.instructor_profiles
  (user_id, years_experience, hourly_rate_cents, travel_distance_km, work_experience)
values (auth.uid(), 5, 4500, 30, 'Vijf jaar groepslessen');

insert into public.instructor_statuses values (auth.uid(), 'zzp');
insert into public.instructor_sports
  select auth.uid(), id from public.sports where slug in ('fitness', 'spinning');
insert into public.instructor_lesson_types (user_id, lesson_type_id)
  select auth.uid(), lt.id
  from public.lesson_types lt
  join public.sports s on s.id = lt.sport_id
  where s.slug = 'spinning' and lt.name = 'Spinning';

do $$
begin
  if not exists (
    select 1
    from public.instructor_lesson_types ilt
    join public.lesson_types lt on lt.id = ilt.lesson_type_id
    where ilt.user_id = auth.uid() and lt.name = 'Spinning'
  ) then
    raise exception 'FAIL: lesvormspecialisatie is niet opgeslagen';
  end if;
end $$;

-- Vervanger heeft ook een instructeursprofiel nodig
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
select set_config('request.jwt.claim.email', 'vervanger@test.nl', false);
insert into public.instructor_profiles (user_id) values (auth.uid());

reset role;
-- Definitief reageren, bevestigen en vervangen vereist een goedgekeurde VOG.
insert into public.document_uploads
  (user_id, doc_type, storage_path, original_filename, status, expires_at)
values
  ('00000000-0000-0000-0000-000000000001', 'vog',
   'tests/instructeur-vog.pdf', 'instructeur-vog.pdf', 'approved', current_date + 365),
  ('00000000-0000-0000-0000-000000000003', 'vog',
   'tests/vervanger-vog.pdf', 'vervanger-vog.pdf', 'approved', current_date + 365);

do $$
begin
  -- trigger moet proefabonnementen hebben aangemaakt
  if (select count(*) from public.subscriptions
      where instructor_id in (
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000003'
      )) <> 2 then
    raise exception 'FAIL: instructeurstrial niet aangemaakt';
  end if;
  if not public.instructor_has_access('00000000-0000-0000-0000-000000000001') then
    raise exception 'FAIL: trial geeft geen toegang';
  end if;
end $$;

-- ===== Organisatie richt zich in =====
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
select set_config('request.jwt.claim.email', 'sportschool@test.nl', false);

insert into public.organizations (id, name, org_type, created_by, contact_name, contact_email, contact_phone)
values ('10000000-0000-0000-0000-000000000001', 'FitZone Utrecht', 'gym', auth.uid(),
        'Otto Organisatie', 'contact@fitzone.nl', '0301234567');

insert into public.organization_members (organization_id, user_id, member_role)
values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'owner');

insert into public.organization_locations (id, organization_id, name, city_id)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
        'FitZone Centrum', (select id from public.cities where name = 'Utrecht'));

-- Opdracht plaatsen (vereist actieve vestigingstoegang → trial via trigger)
insert into public.jobs
  (id, organization_id, location_id, created_by, job_type, sport_id, title,
   description, starts_on, start_time, end_time, pay_type, pay_hourly_rate_cents)
values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001', auth.uid(), 'urgent_substitute',
   (select id from public.sports where slug = 'spinning'),
   'Spoed: spinning les vanavond', 'Inval nodig voor de avondles.',
   current_date + 1, '19:00', '20:00', 'hourly', 5000);

-- ===== Instructeur ziet match en reageert =====
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select set_config('request.jwt.claim.email', 'instructeur@test.nl', false);

do $$
declare
  m record;
begin
  select * into m from public.open_job_matches()
  where job_id = '30000000-0000-0000-0000-000000000001';
  if m.job_id is null then
    raise exception 'FAIL: match niet gevonden';
  end if;
  if not m.sport_match then
    raise exception 'FAIL: sport_match moet true zijn';
  end if;
  if m.distance_km > 1 then
    raise exception 'FAIL: afstand Utrecht-Utrecht moet ~0 zijn, is %', m.distance_km;
  end if;
  if m.match_score < 60 then
    raise exception 'FAIL: verwacht hoge matchscore, is %', m.match_score;
  end if;
end $$;

-- Een verlopen VOG blokkeert reageren server-side, ook bij directe RPC-aanroep.
reset role;
update public.document_uploads
set expires_at = current_date - 1
where user_id = '00000000-0000-0000-0000-000000000001' and doc_type = 'vog';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select set_config('request.jwt.claim.email', 'instructeur@test.nl', false);
do $$
begin
  begin
    perform public.apply_to_job(
      '30000000-0000-0000-0000-000000000001', 'Mag niet lukken', ''
    );
    raise exception 'FAIL: reageren met verlopen VOG had geblokkeerd moeten zijn';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;
reset role;
update public.document_uploads
set expires_at = current_date + 365
where user_id = '00000000-0000-0000-0000-000000000001' and doc_type = 'vog';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select set_config('request.jwt.claim.email', 'instructeur@test.nl', false);

select public.apply_to_job('30000000-0000-0000-0000-000000000001',
  'Ik kan vanavond invallen!', 'Hele avond beschikbaar');

-- Tegenvoorstel door instructeur
do $$
declare
  v_app uuid;
  v_offer uuid;
begin
  select id into v_app from public.job_applications
  where job_id = '30000000-0000-0000-0000-000000000001' and instructor_id = auth.uid();
  v_offer := public.create_counteroffer(v_app, 'hourly', 5500, 'Spoedtarief');
end $$;

-- ===== Organisatie accepteert tegenvoorstel en kiest kandidaat =====
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
select set_config('request.jwt.claim.email', 'sportschool@test.nl', false);

do $$
declare
  v_offer uuid;
  v_app uuid;
begin
  select co.id into v_offer
  from public.job_counteroffers co
  join public.job_applications a on a.id = co.application_id
  where a.job_id = '30000000-0000-0000-0000-000000000001'
  order by co.created_at desc limit 1;
  perform public.respond_counteroffer(v_offer, true);

  select id into v_app from public.job_applications
  where job_id = '30000000-0000-0000-0000-000000000001';
  perform public.select_candidate(v_app, '{"tarief": "55 euro per uur"}'::jsonb);
end $$;

-- Contactgegevens mogen NOG NIET zichtbaar zijn (niet bevestigd)
do $$
begin
  if exists (
    select 1 from public.get_job_contact_details('30000000-0000-0000-0000-000000000001')
  ) then
    raise exception 'FAIL: contactgegevens zichtbaar vóór bevestiging';
  end if;
end $$;

-- ===== Instructeur bevestigt =====
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select set_config('request.jwt.claim.email', 'instructeur@test.nl', false);

select public.confirm_job('30000000-0000-0000-0000-000000000001');

do $$
declare
  v_contact record;
begin
  if (select status from public.jobs where id = '30000000-0000-0000-0000-000000000001') <> 'confirmed' then
    raise exception 'FAIL: opdracht niet bevestigd';
  end if;

  select * into v_contact
  from public.get_job_contact_details('30000000-0000-0000-0000-000000000001');
  if v_contact.email is distinct from 'contact@fitzone.nl' then
    raise exception 'FAIL: contactgegevens organisatie niet zichtbaar na bevestiging';
  end if;
end $$;

-- Chatbericht sturen
do $$
declare
  v_chat uuid;
begin
  select id into v_chat from public.chats
  where job_id = '30000000-0000-0000-0000-000000000001';
  perform public.send_chat_message(v_chat, 'Tot vanavond!');
end $$;

-- Vervanger voorstellen en goedkeuren
select public.propose_replacement('30000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000003', 'Ziek geworden');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
select set_config('request.jwt.claim.email', 'sportschool@test.nl', false);

do $$
declare
  v_rep uuid;
begin
  select id into v_rep from public.replacements
  where job_id = '30000000-0000-0000-0000-000000000001'
  order by created_at desc limit 1;
  perform public.decide_replacement(v_rep, true);

  if (select instructor_id from public.job_confirmations
      where job_id = '30000000-0000-0000-0000-000000000001')
     <> '00000000-0000-0000-0000-000000000003' then
    raise exception 'FAIL: vervanger niet doorgevoerd in bevestiging';
  end if;
end $$;

-- Opdracht afronden en beoordelen
select public.complete_job('30000000-0000-0000-0000-000000000001');
select public.submit_review('30000000-0000-0000-0000-000000000001', 5);

-- Review nog niet vrijgegeven (tegenpartij moet ook beoordelen)
do $$
begin
  if exists (
    select 1 from public.reviews
    where job_id = '30000000-0000-0000-0000-000000000001' and released_at is not null
  ) then
    raise exception 'FAIL: review te vroeg vrijgegeven';
  end if;
end $$;

-- Maak een tweede open opdracht om de verplichte reviewblokkade als echte
-- commerciële RPC te testen. De organisatie heeft haar review al afgerond.
insert into public.jobs
  (id, organization_id, location_id, created_by, job_type, sport_id, title,
   starts_on, start_time, end_time, pay_type, pay_hourly_rate_cents)
values
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001', auth.uid(), 'one_time',
   (select id from public.sports where slug = 'fitness'),
   'Reviewblokkade test', current_date + 10, '12:00', '13:00', 'hourly', 4500);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
select set_config('request.jwt.claim.email', 'vervanger@test.nl', false);
do $$
begin
  if not public.has_pending_review(auth.uid()) then
    raise exception 'FAIL: vervanger hoort een openstaande review te hebben';
  end if;
  begin
    perform public.apply_to_job(
      '30000000-0000-0000-0000-000000000004', 'Eerst review afronden', ''
    );
    raise exception 'FAIL: openstaande review had reageren moeten blokkeren';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;

select public.submit_review('30000000-0000-0000-0000-000000000001', 4);

do $$
begin
  if public.has_pending_review(auth.uid()) then
    raise exception 'FAIL: reviewblokkade bleef actief na beoordeling';
  end if;
end $$;

select public.apply_to_job(
  '30000000-0000-0000-0000-000000000004', 'Review afgerond, nu beschikbaar', ''
);

-- Klachten blijven aparte, private objecten naast reviews.
insert into public.complaints (job_id, reported_by, category, details)
values (
  '30000000-0000-0000-0000-000000000001', auth.uid(), 'conduct',
  'De samenwerking moet door SportMatch afzonderlijk worden beoordeeld.'
);

do $$
begin
  if (select count(*) from public.reviews
      where job_id = '30000000-0000-0000-0000-000000000001'
        and released_at is not null) <> 2 then
    raise exception 'FAIL: reviews niet vrijgegeven na beide beoordelingen';
  end if;
end $$;

-- ===== Billing gate: verlopen abonnement blokkeert reageren =====
reset role;
update public.subscriptions
set status = 'expired'
where instructor_id = '00000000-0000-0000-0000-000000000001';

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
select set_config('request.jwt.claim.email', 'sportschool@test.nl', false);

insert into public.jobs
  (id, organization_id, location_id, created_by, job_type, sport_id, title,
   starts_on, start_time, end_time, pay_type, pay_amount_cents)
values
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001', auth.uid(), 'one_time',
   (select id from public.sports where slug = 'fitness'),
   'Zaterdagochtend fitness', current_date + 7, '09:00', '10:00', 'fixed', 7500);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select set_config('request.jwt.claim.email', 'instructeur@test.nl', false);

do $$
begin
  begin
    perform public.apply_to_job('30000000-0000-0000-0000-000000000002', 'Ik wil wel!');
    raise exception 'FAIL: reageren had geblokkeerd moeten zijn zonder actief abonnement';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      -- verwachte blokkade
  end;
end $$;

-- Mockbetaling activeert weer
do $$
declare
  v_sub uuid;
begin
  select id into v_sub from public.subscriptions where instructor_id = auth.uid();
  perform public.mock_activate_subscription(v_sub);
end $$;

select public.apply_to_job('30000000-0000-0000-0000-000000000002', 'Ik wil wel!');

-- ===== Lessenblokken: aansluitend, gedeeltelijk, volledig en dubbelbezetting =====
reset role;
insert into public.jobs
  (id, organization_id, location_id, created_by, job_type, sport_id, title,
   starts_on, start_time, end_time, pay_type, pay_hourly_rate_cents,
   partial_block_allowed)
values
  ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
   'temporary', (select id from public.sports where slug = 'kickboksen'),
   'Drie aansluitende kickbokslessen', current_date + 20, '18:00', '21:00',
   'hourly', 4000, true),
  ('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
   'temporary', (select id from public.sports where slug = 'kickboksen'),
   'Volledig avondblok', current_date + 21, '18:00', '20:00',
   'fixed', null, false);

update public.jobs set pay_amount_cents = 10000
where id = '30000000-0000-0000-0000-000000000006';

insert into public.job_segments (id, job_id, position, start_time, end_time, custom_lesson_type)
values
  ('50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000005', 1, '18:00', '19:00', 'Beginners'),
  ('50000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000005', 2, '19:00', '20:00', 'Gevorderden'),
  ('50000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000005', 3, '20:00', '21:00', 'Techniek'),
  ('50000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000006', 1, '18:00', '19:00', 'Beginners'),
  ('50000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000006', 2, '19:00', '20:00', 'Gevorderden');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select set_config('request.jwt.claim.email', 'instructeur@test.nl', false);
do $$
begin
  begin
    perform public.apply_to_job(
      '30000000-0000-0000-0000-000000000005', 'Niet aansluitend', '',
      array[
        '50000000-0000-0000-0000-000000000001',
        '50000000-0000-0000-0000-000000000003'
      ]::uuid[]
    );
    raise exception 'FAIL: niet-aansluitende blokselectie had moeten mislukken';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;

select public.apply_to_job(
  '30000000-0000-0000-0000-000000000005', 'Ik neem de eerste twee lessen', '',
  array[
    '50000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000002'
  ]::uuid[]
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
select set_config('request.jwt.claim.email', 'sportschool@test.nl', false);
do $$
declare v_app uuid;
begin
  select id into v_app from public.job_applications
  where job_id = '30000000-0000-0000-0000-000000000005'
    and instructor_id = '00000000-0000-0000-0000-000000000001';
  if public.select_candidate_segments(
    v_app,
    array[
      '50000000-0000-0000-0000-000000000001',
      '50000000-0000-0000-0000-000000000002'
    ]::uuid[],
    '{"tarief": "40 euro per uur"}'::jsonb
  ) <> 2 then
    raise exception 'FAIL: gedeeltelijke blokselectie is niet opgeslagen';
  end if;
end $$;

-- De actieve unieke index voorkomt toewijzing van hetzelfde lesonderdeel aan
-- een tweede instructeur, ook buiten de normale RPC om.
reset role;
do $$
declare v_other_app uuid;
begin
  insert into public.job_applications (job_id, instructor_id, message)
  values (
    '30000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000003', 'Tweede kandidaat'
  ) returning id into v_other_app;
  begin
    insert into public.job_segment_confirmations (
      job_id, segment_id, application_id, instructor_id, organization_agreed_by
    ) values (
      '30000000-0000-0000-0000-000000000005',
      '50000000-0000-0000-0000-000000000001', v_other_app,
      '00000000-0000-0000-0000-000000000003',
      '00000000-0000-0000-0000-000000000002'
    );
    raise exception 'FAIL: dubbel bezet segment had moeten mislukken';
  exception
    when unique_violation then null;
  end;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select set_config('request.jwt.claim.email', 'instructeur@test.nl', false);
do $$
begin
  if public.confirm_job_segments('30000000-0000-0000-0000-000000000005') <> 2 then
    raise exception 'FAIL: gedeeltelijke blokbevestiging telde niet twee lessen';
  end if;
  if (select status from public.jobs where id = '30000000-0000-0000-0000-000000000005') <> 'open' then
    raise exception 'FAIL: blok met onbezet segment moet open blijven';
  end if;
end $$;

select public.cancel_confirmed_job(
  '30000000-0000-0000-0000-000000000005', 'Onverwachte verhindering'
);
do $$
begin
  if not exists (
    select 1 from public.cancellations
    where job_id = '30000000-0000-0000-0000-000000000005'
      and compensation_pct = 150
      and compensation_amount_cents = 12000
      and cardinality(segment_ids) = 2
  ) then
    raise exception 'FAIL: gedeeltelijke blokannulering is onjuist berekend';
  end if;
end $$;

-- Een volledig blok accepteert geen gedeeltelijke reactie.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
select set_config('request.jwt.claim.email', 'vervanger@test.nl', false);
do $$
begin
  begin
    perform public.apply_to_job(
      '30000000-0000-0000-0000-000000000006', 'Slechts één les', '',
      array['50000000-0000-0000-0000-000000000004']::uuid[]
    );
    raise exception 'FAIL: gedeeltelijke reactie op volledig blok had moeten mislukken';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;

select public.apply_to_job(
  '30000000-0000-0000-0000-000000000006', 'Ik neem het hele blok', '',
  array[
    '50000000-0000-0000-0000-000000000004',
    '50000000-0000-0000-0000-000000000005'
  ]::uuid[]
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
select set_config('request.jwt.claim.email', 'sportschool@test.nl', false);
do $$
declare v_app uuid;
begin
  select id into v_app from public.job_applications
  where job_id = '30000000-0000-0000-0000-000000000006'
    and instructor_id = '00000000-0000-0000-0000-000000000003';
  perform public.select_candidate_segments(
    v_app,
    array[
      '50000000-0000-0000-0000-000000000004',
      '50000000-0000-0000-0000-000000000005'
    ]::uuid[]
  );
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
select set_config('request.jwt.claim.email', 'vervanger@test.nl', false);
select public.confirm_job_segments('30000000-0000-0000-0000-000000000006');
do $$
begin
  if (select status from public.jobs where id = '30000000-0000-0000-0000-000000000006') <> 'confirmed' then
    raise exception 'FAIL: volledig bevestigd blok is niet definitief';
  end if;
end $$;

-- ===== RLS-isolatie: vreemde gebruiker ziet geen chats/documenten =====
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
select set_config('request.jwt.claim.email', 'vervanger@test.nl', false);

do $$
begin
  -- Vervanger is deelnemer van zijn eigen chat maar niet van andermans notificatievoorraad
  if exists (
    select 1 from public.notifications
    where user_id <> auth.uid()
  ) then
    raise exception 'FAIL: notificaties van anderen zichtbaar';
  end if;
end $$;

-- ===== Annuleringsregeling: percentage bij korte termijn =====
reset role;
-- zet een bevestigde opdracht neer die over 1 uur begint
insert into public.jobs
  (id, organization_id, location_id, created_by, job_type, sport_id, title,
   starts_on, start_time, end_time, pay_type, pay_amount_cents, status)
values
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
   'one_time', (select id from public.sports where slug = 'fitness'),
   'Les over een uur',
   (now() at time zone 'Europe/Amsterdam')::date,
   ((now() at time zone 'Europe/Amsterdam') + interval '1 hour')::time,
   ((now() at time zone 'Europe/Amsterdam') + interval '2 hours')::time,
   'fixed', 6000, 'confirmed');

insert into public.job_confirmations
  (job_id, instructor_id, organization_agreed_at, instructor_agreed_at, confirmed_at)
values
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
   now(), now(), now());

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select set_config('request.jwt.claim.email', 'instructeur@test.nl', false);

select public.cancel_confirmed_job(
  '30000000-0000-0000-0000-000000000003', 'Acute ziekte', true,
  'private/tests/noodsituatie.pdf'
);

do $$
declare
  v_pct integer;
  v_amount integer;
begin
  select compensation_pct, compensation_amount_cents into v_pct, v_amount
  from public.cancellations
  where job_id = '30000000-0000-0000-0000-000000000003';
  if v_pct <> 150 then
    raise exception 'FAIL: verwacht 150%% annuleringsregistratie, kreeg %', v_pct;
  end if;
  if v_amount <> 9000 then
    raise exception 'FAIL: verwacht 9000 cent vergoeding, kreeg %', v_amount;
  end if;
  if (select force_majeure_status from public.cancellations
      where job_id = '30000000-0000-0000-0000-000000000003') <> 'pending_review' then
    raise exception 'FAIL: overmachtsverzoek staat niet open voor adminbeoordeling';
  end if;
end $$;

-- Admin kan aantoonbare overmacht beoordelen zonder automatische betaling.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000009', false);
select set_config('request.jwt.claim.email', 'admin@test.nl', false);
do $$
declare v_cancellation uuid;
begin
  select id into v_cancellation from public.cancellations
  where job_id = '30000000-0000-0000-0000-000000000003';
  perform public.admin_review_force_majeure(
    v_cancellation, true, 'Bewijs gecontroleerd en overmacht goedgekeurd.'
  );
  if exists (
    select 1 from public.cancellations
    where id = v_cancellation
      and (force_majeure_status <> 'approved' or compensation_amount_cents <> 0)
  ) then
    raise exception 'FAIL: goedgekeurde overmacht is niet correct verwerkt';
  end if;
end $$;

-- Interne SECURITY DEFINER-helpers en muterende RPC's zijn niet voor anon.
reset role;
do $$
begin
  if has_function_privilege('anon', 'public.internal_notify(uuid,text,text,text,text)', 'EXECUTE') then
    raise exception 'FAIL: anon kan interne notificatiehelper uitvoeren';
  end if;
  if has_function_privilege('anon', 'public.apply_to_job(uuid,text,text,uuid[])', 'EXECUTE') then
    raise exception 'FAIL: anon kan apply_to_job uitvoeren';
  end if;
  if not has_function_privilege('authenticated', 'public.apply_to_job(uuid,text,text,uuid[])', 'EXECUTE') then
    raise exception 'FAIL: authenticated mist execute op apply_to_job';
  end if;
end $$;

reset role;
select 'ALLE SMOKETESTS GESLAAGD' as resultaat;
