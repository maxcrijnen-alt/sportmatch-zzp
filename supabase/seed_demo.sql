-- SportMatch ZZP — demo-data (SQL-versie)
-- Plak dit bestand in de Supabase SQL Editor en klik Run.
-- Draai eerst de migrations (0001 t/m 0003) en supabase/seed.sql.
--
-- Maakt aan: 5 demo-accounts + 18 extra instructeurs + 4 extra
-- organisatiebeheerders, 5 organisaties met 8 vestigingen, 16 open
-- opdrachten/vacatures, een afgeronde opdracht met reviews en chat, en een
-- openstaande reactie met tegenvoorstel.
--
-- Wachtwoord voor ALLE demo-accounts: SportMatch2026!

do $$
declare
  demo_password constant text := 'SportMatch2026!';

  admin_id uuid;
  instructor1 uuid;
  instructor2 uuid;
  org_owner1 uuid;
  planner_id uuid;

  instructor_ids uuid[] := '{}';
  instructor_cities text[] := array[
    'Utrecht', 'Amsterdam', 'Amsterdam', 'Rotterdam', 'Den Haag', 'Utrecht',
    'Haarlem', 'Leiden', 'Delft', 'Amstelveen', 'Zoetermeer', 'Gouda',
    'Hilversum', 'Almere', 'Zaandam', 'Hoofddorp', 'Nieuwegein', 'Rijswijk',
    'Schiedam', 'Katwijk'
  ];
  first_names text[] := array[
    'Sanne', 'Tim', 'Lisa', 'Daan', 'Emma', 'Bram', 'Fleur', 'Ruben',
    'Nina', 'Max', 'Sofie', 'Lars', 'Julia', 'Tom', 'Anouk', 'Kevin',
    'Maud', 'Rick'
  ];
  last_names text[] := array[
    'Jansen', 'de Vries', 'Visser', 'Smit', 'Meijer', 'Mulder', 'Bos',
    'Peters', 'Hendriks', 'Dekker', 'Vermeulen', 'van Leeuwen', 'Brouwer',
    'de Groot', 'Kuipers', 'Post', 'Willems', 'Smits'
  ];

  sport_slugs text[];
  qual_names text[];
  statuses text[];
  my_sports text[];
  my_quals text[];

  org_ids uuid[] := '{}';
  org_owner_ids uuid[] := '{}';
  loc_ids uuid[] := '{}';

  new_org uuid;
  new_loc uuid;
  new_user uuid;
  new_job uuid;
  done_job uuid;
  done_application uuid;
  open_application uuid;
  demo_chat uuid;

  i integer;

  -- hulpfunctie-resultaten
  v_city uuid;
begin
  -- ------------------------------------------------------------- guard
  if exists (select 1 from public.profiles where email = 'admin@sportmatch.test') then
    raise exception 'Demo-data lijkt al aanwezig (admin@sportmatch.test bestaat).';
  end if;

  select array_agg(slug order by slug) into sport_slugs from public.sports;
  select array_agg(name order by name) into qual_names from public.qualifications;

  if sport_slugs is null then
    raise exception 'Lookups ontbreken. Draai eerst supabase/seed.sql.';
  end if;

  -- ------------------------------------------------- hulpfunctie (tijdelijk)
  create or replace function pg_temp.demo_user(p_email text, p_name text, p_role text)
  returns uuid
  language plpgsql
  as $fn$
  declare
    uid uuid := gen_random_uuid();
  begin
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change, email_change_token_new,
      created_at, updated_at
    ) values (
      uid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      p_email,
      extensions.crypt('SportMatch2026!', extensions.gen_salt('bf')),
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      jsonb_build_object('full_name', p_name, 'role', p_role),
      '', '', '', '',
      now(), now()
    );

    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      uid::text,
      uid,
      jsonb_build_object('sub', uid::text, 'email', p_email, 'email_verified', true),
      'email',
      now(), now(), now()
    );

    return uid;
  end;
  $fn$;

  -- --------------------------------------------------------------- accounts
  admin_id := pg_temp.demo_user('admin@sportmatch.test', 'Ada Admin', 'instructor');
  update public.profiles
  set role = 'admin', onboarding_completed = true
  where id = admin_id;

  instructor1 := pg_temp.demo_user('instructeur@sportmatch.test', 'Iris van Dam', 'instructor');
  instructor2 := pg_temp.demo_user('instructeur2@sportmatch.test', 'Joost Bakker', 'instructor');
  org_owner1 := pg_temp.demo_user('sportschool@sportmatch.test', 'Olivia Sportschool', 'organization');
  planner_id := pg_temp.demo_user('planner@sportmatch.test', 'Pieter Planner', 'organization');

  instructor_ids := array[instructor1, instructor2];
  for i in 1..18 loop
    new_user := pg_temp.demo_user(
      format('instructeur%s@sportmatch.test', i + 2),
      first_names[i] || ' ' || last_names[i],
      'instructor'
    );
    instructor_ids := instructor_ids || new_user;
  end loop;

  -- ------------------------------------------------------------ instructeurs
  for i in 1..array_length(instructor_ids, 1) loop
    select id into v_city from public.cities where name = instructor_cities[i];

    update public.profiles
    set phone = '06' || (10000000 + (i - 1) * 111111)::text,
        city_id = coalesce(v_city, (select id from public.cities where name = 'Utrecht')),
        onboarding_completed = true
    where id = instructor_ids[i];

    insert into public.instructor_profiles (
      user_id, birth_date, years_experience, hourly_rate_cents,
      travel_distance_km, work_experience, kvk_number, btw_number
    ) values (
      instructor_ids[i],
      make_date(1990 + ((i - 1) % 10), ((i - 1) % 9) + 1, 15),
      ((i - 1) % 12) + 1,
      3500 + ((i - 1) % 8) * 500,
      15 + ((i - 1) % 5) * 10,
      'Ervaren sportinstructeur met passie voor groepslessen.',
      case when (i - 1) % 2 = 0 then (60000000 + i)::text else '' end,
      ''
    );

    statuses := case when (i - 1) % 2 = 0
      then array['zzp']
      else array['employee', 'other']
    end;
    if (i - 1) % 3 = 0 then
      statuses := array_append(statuses, 'student');
    end if;

    insert into public.instructor_statuses (user_id, status)
    select instructor_ids[i], unnest(statuses)::public.instructor_status
    on conflict do nothing;

    my_sports := array[
      sport_slugs[((i - 1) % array_length(sport_slugs, 1)) + 1],
      sport_slugs[((i + 2) % array_length(sport_slugs, 1)) + 1],
      sport_slugs[((i + 6) % array_length(sport_slugs, 1)) + 1]
    ];
    insert into public.instructor_sports (user_id, sport_id)
    select distinct instructor_ids[i], s.id
    from public.sports s
    where s.slug = any (my_sports)
    on conflict do nothing;

    my_quals := array[
      qual_names[((i - 1) % array_length(qual_names, 1)) + 1],
      qual_names[((i + 3) % array_length(qual_names, 1)) + 1]
    ];
    insert into public.instructor_qualifications (user_id, qualification_id)
    select distinct instructor_ids[i], q.id
    from public.qualifications q
    where q.name = any (my_quals)
    on conflict do nothing;

    insert into public.availability_rules (user_id, weekday, start_time, end_time)
    values
      (instructor_ids[i], 2, '18:00', '22:00'),
      (instructor_ids[i], 4, '18:00', '22:00'),
      (instructor_ids[i], 6, '08:00', '13:00');
  end loop;

  -- Documenten voor de twee demo-instructeurs
  insert into public.document_uploads
    (user_id, doc_type, storage_path, original_filename, status, expires_at,
     reviewed_by, reviewed_at)
  values
    (instructor1, 'sport_diploma', instructor1 || '/sport_diploma/demo.pdf',
     'fitness-trainer-b.pdf', 'approved', null, admin_id, now()),
    (instructor1, 'first_aid', instructor1 || '/first_aid/demo.pdf',
     'ehbo.pdf', 'approved', (current_date + interval '1 year')::date, admin_id, now()),
    (instructor1, 'vog', instructor1 || '/vog/demo.pdf',
     'vog.pdf', 'pending', null, null, null),
    (instructor2, 'sport_diploma', instructor2 || '/sport_diploma/demo.pdf',
     'yoga-200ryt.pdf', 'pending', null, null, null);

  -- ------------------------------------------------------------ organisaties
  org_owner_ids := array[org_owner1];
  for i in 2..5 loop
    new_user := pg_temp.demo_user(
      format('organisatie%s@sportmatch.test', i),
      format('Beheerder Organisatie %s', i),
      'organization'
    );
    org_owner_ids := org_owner_ids || new_user;
  end loop;

  for i in 1..5 loop
    update public.profiles
    set onboarding_completed = true, phone = '03012345' || i::text
    where id = org_owner_ids[i];

    insert into public.organizations
      (name, org_type, kvk_number, contact_name, contact_email, contact_phone, created_by)
    values (
      (array['FitZone Utrecht', 'YogaHuis Amsterdam', 'Zwembad De Golf',
             'Padelclub Den Haag', 'Hotel Actief Haarlem'])[i],
      (array['gym', 'yoga_studio', 'swimming_pool', 'sports_club', 'hotel'])[i]::public.organization_type,
      (70000000 + i)::text,
      'Contact ' || (array['FitZone', 'YogaHuis', 'De Golf', 'Padelclub', 'Hotel Actief'])[i],
      'contact@demo-org' || i || '.nl',
      '01012345' || i::text,
      org_owner_ids[i]
    )
    returning id into new_org;

    org_ids := org_ids || new_org;

    insert into public.organization_members (organization_id, user_id, member_role)
    values (new_org, org_owner_ids[i], 'owner');
  end loop;

  -- Vestigingen (8 stuks)
  for i in 1..8 loop
    insert into public.organization_locations
      (organization_id, name, street, house_number, postal_code, city_id)
    values (
      org_ids[(array[1, 1, 2, 2, 3, 4, 4, 5])[i]],
      (array['FitZone Centrum', 'FitZone Leidsche Rijn', 'YogaHuis De Pijp',
             'YogaHuis West', 'De Golf Rotterdam', 'Padelclub Centrum',
             'Padelclub Scheveningen', 'Hotel Actief Fitness'])[i],
      'Sportlaan',
      i::text,
      (1000 + i * 111)::text || ' AB',
      (select id from public.cities where name =
        (array['Utrecht', 'Utrecht', 'Amsterdam', 'Amsterdam', 'Rotterdam',
               'Den Haag', 'Den Haag', 'Haarlem'])[i])
    )
    returning id into new_loc;

    loc_ids := loc_ids || new_loc;
  end loop;

  -- planner@ wordt planner bij FitZone Utrecht
  update public.profiles set onboarding_completed = true where id = planner_id;
  insert into public.organization_members (organization_id, user_id, member_role)
  values (org_ids[1], planner_id, 'planner');

  -- ---------------------------------------------------------------- opdrachten
  for i in 1..16 loop
    insert into public.jobs (
      organization_id, location_id, created_by, job_type, sport_id, title,
      description, starts_on, start_time, end_time, recurrence_note,
      pay_type, pay_amount_cents, pay_hourly_rate_cents, pay_is_negotiable,
      required_level, expected_participants, contact_name
    )
    select
      org_ids[spec.org_index],
      loc_ids[spec.loc_index],
      org_owner_ids[spec.org_index],
      spec.job_type::public.job_type,
      (select id from public.sports where slug = spec.sport),
      spec.title,
      'Wij zoeken een enthousiaste instructeur. Ervaring met de doelgroep is een pre. Materiaal en muziekinstallatie aanwezig.',
      current_date + spec.days,
      spec.start_time::time,
      spec.end_time::time,
      coalesce(spec.recurrence, ''),
      spec.pay_type::public.pay_type,
      spec.fixed_cents,
      spec.hourly_cents,
      spec.job_type = 'urgent_substitute',
      'Alle niveaus',
      15,
      'Contact demo-organisatie'
    from (
      values
        -- 3 spoedopdrachten
        (1,  'urgent_substitute', 'spinning',          'SPOED: spinning vanavond',                  1,  '19:00', '20:00', 'hourly', null::integer, 5500, null::text, 1, 1),
        (2,  'urgent_substitute', 'groepsles',         'SPOED: bodypump morgenochtend',             1,  '09:00', '10:00', 'hourly', null, 5000, null, 1, 2),
        (3,  'urgent_substitute', 'zwemmen',           'SPOED: badmeester zaterdag',                2,  '08:00', '12:00', 'fixed', 18000, null, null, 3, 5),
        -- 7 eenmalige opdrachten
        (4,  'one_time',          'yoga',              'Vinyasa yoga zondagochtend',                5,  '09:30', '10:45', 'fixed', 7500, null, null, 2, 3),
        (5,  'one_time',          'pilates',           'Pilates workshop',                          8,  '19:00', '20:30', 'both', 9000, 5500, null, 2, 4),
        (6,  'one_time',          'padel',             'Padelclinic voor beginners',                10, '14:00', '16:00', 'fixed', 12000, null, null, 4, 6),
        (7,  'one_time',          'bootcamp',          'Bootcamp bedrijfsuitje',                    12, '10:00', '11:30', 'fixed', 11000, null, null, 5, 8),
        (8,  'one_time',          'fitness',           'Fitness introles hotelgasten',              6,  '17:00', '18:00', 'hourly', null, 4500, null, 5, 8),
        (9,  'one_time',          'personal-training', 'PT-sessies zaterdag',                       9,  '10:00', '14:00', 'hourly', null, 6000, null, 1, 1),
        (10, 'one_time',          'tennis',            'Tennisles jeugd',                           15, '16:00', '18:00', 'hourly', null, 4000, null, 4, 7),
        -- 3 terugkerende opdrachten
        (11, 'recurring',         'spinning',          'Vaste spinninginstructeur dinsdagavond',    7,  '19:00', '20:00', 'hourly', null, 5000, 'Elke dinsdag, minimaal 12 weken', 1, 1),
        (12, 'recurring',         'yoga',              'Wekelijkse yin yoga donderdag',             9,  '20:00', '21:15', 'fixed', 8000, null, 'Elke donderdagavond', 2, 3),
        (13, 'recurring',         'zwemmen',           'Zwemles ABC zaterdagochtend',               11, '09:00', '12:00', 'hourly', null, 4500, 'Elke zaterdag tijdens het schooljaar', 3, 5),
        -- 3 vaste vacatures
        (14, 'permanent',         'fitness',           'Fitnessinstructeur (24-32 uur)',            20, '09:00', '17:00', 'both', 280000, 1800, null, 1, 2),
        (15, 'permanent',         'groepsles',         'Allround groepslesinstructeur (vast)',      25, '08:00', '16:00', 'hourly', null, 1900, null, 2, 4),
        (16, 'permanent',         'padel',             'Hoofdtrainer padel (fulltime)',             30, '12:00', '20:00', 'fixed', 320000, null, null, 4, 6)
    ) as spec (n, job_type, sport, title, days, start_time, end_time, pay_type,
               fixed_cents, hourly_cents, recurrence, org_index, loc_index)
    where spec.n = i
    returning id into new_job;

    -- diploma-eisen voor zwemmen en fitness
    insert into public.job_requirements (job_id, qualification_id)
    select new_job, q.id
    from public.jobs j
    join public.sports s on s.id = j.sport_id
    join public.qualifications q on (
      (s.slug = 'zwemmen' and q.name in ('Zwemonderwijzer ABC', 'Lifeguard'))
      or (s.slug = 'fitness' and q.name = 'Fitness Trainer A')
    )
    where j.id = new_job
    on conflict do nothing;
  end loop;

  -- ------------------------------------------- afgeronde opdracht met reviews
  insert into public.jobs (
    organization_id, location_id, created_by, job_type, sport_id, title,
    description, starts_on, start_time, end_time, pay_type,
    pay_hourly_rate_cents, contact_name, status
  ) values (
    org_ids[1], loc_ids[1], org_owner1, 'one_time',
    (select id from public.sports where slug = 'spinning'),
    'Spinning inval (afgerond)', 'Afgeronde demo-opdracht.',
    current_date - 7, '19:00', '20:00', 'hourly', 5000,
    'Olivia Sportschool', 'completed'
  )
  returning id into done_job;

  insert into public.job_applications (job_id, instructor_id, message, status)
  values (done_job, instructor1, 'Ik neem de les graag over!', 'accepted')
  returning id into done_application;

  insert into public.job_confirmations (
    job_id, application_id, instructor_id, terms,
    organization_agreed_at, organization_agreed_by,
    instructor_agreed_at, confirmed_at
  ) values (
    done_job, done_application, instructor1,
    '{"note": "50 euro per uur, 15 minuten vooraf aanwezig"}'::jsonb,
    now() - interval '9 days', org_owner1,
    now() - interval '8 days', now() - interval '8 days'
  );

  insert into public.reviews
    (job_id, reviewer_id, reviewee_id, side, rating, released_at)
  values
    (done_job, org_owner1, instructor1, 'organization', 5, now()),
    (done_job, instructor1, org_owner1, 'instructor', 4, now());

  insert into public.chats (job_id, organization_id, instructor_id)
  values (done_job, org_ids[1], instructor1)
  returning id into demo_chat;

  insert into public.chat_messages (chat_id, sender_id, body, system_event)
  values
    (demo_chat, null,
     'Iris van Dam heeft gereageerd op "Spinning inval (afgerond)".',
     'application_created'),
    (demo_chat, instructor1,
     'Ik neem de les graag over! Hoe groot is de groep?', null),
    (demo_chat, org_owner1,
     'Top! Meestal zo''n 18 deelnemers. Muziek staat klaar.', null),
    (demo_chat, null,
     'De opdracht is definitief bevestigd. Contactgegevens zijn nu zichtbaar voor beide partijen.',
     'job_confirmed');

  -- Openstaande reactie + tegenvoorstel op de eerste spoedopdracht
  insert into public.job_applications (job_id, instructor_id, message, status)
  select j.id, instructor2, 'Ik kan vanavond invallen.', 'pending'
  from public.jobs j
  where j.title = 'SPOED: spinning vanavond'
  returning id into open_application;

  insert into public.job_counteroffers
    (application_id, created_by, side, pay_type, amount_cents, message)
  values
    (open_application, instructor2, 'instructor', 'hourly', 6000,
     'Spoedtarief i.v.m. korte termijn');

  raise notice 'Demo-data geladen. Wachtwoord voor alle demo-accounts: %', demo_password;
end;
$$;

select 'DEMO-DATA GELADEN — wachtwoord voor alle accounts: SportMatch2026!' as resultaat;
