-- Candidate discovery: complete result set beyond the old 100/12/6 limits,
-- filters, sorting, paging, statistics parity, availability states,
-- authorization, demo isolation and privacy. Synthetic fixtures inside one
-- rolled-back transaction; never execute test files against production.
\set ON_ERROR_STOP on
begin;

create function pg_temp.cd(label text) returns uuid language sql immutable
as $$ select md5('candidate-discovery-2026-11-15-' || label)::uuid $$;
grant execute on function pg_temp.cd(text) to authenticated;

create function pg_temp.check(condition boolean, label text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if condition is distinct from true then
    raise exception 'FAIL: %', label;
  end if;
end $$;
grant execute on function pg_temp.check(boolean, text) to authenticated;

create function pg_temp.expect_error(statement text, expected_state text, expected text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  execute statement;
  raise exception 'FAIL: statement was accepted: %', statement;
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  if sqlstate <> expected_state or position(expected in sqlerrm) = 0 then
    raise exception 'FAIL: expected % "%", got % "%"', expected_state, expected, sqlstate, sqlerrm;
  end if;
end $$;
grant execute on function pg_temp.expect_error(text, text, text) to authenticated;

create function pg_temp.act_as(label text) returns void
language sql security invoker set search_path = '' as $$
  select set_config('request.jwt.claim.sub', pg_temp.cd(label)::text, false);
$$;
grant execute on function pg_temp.act_as(text) to authenticated;

-- Convenience wrapper: org A search with named overrides as JSON.
create function pg_temp.search(args jsonb default '{}'::jsonb)
returns setof record language plpgsql security invoker set search_path = '' as $$
begin
  return query execute
    'select user_id, full_name, avg_rating, review_count, reliability_score, years_experience,
            distance_km, match_job_id, match_score, availability, in_pool, worked_before,
            pending_application_job_id, invited_pending, applied_to_action_job,
            invited_to_action_job, has_valid_vog, total_count, page_offset
     from public.search_organization_candidates(
       p_organization => $1, p_location => $2, p_job => $3, p_query => $4,
       p_sport => $5, p_lesson_type => $6, p_availability => $7, p_min_rating => $8,
       p_min_experience => $9, p_max_distance => $10, p_relation => $11,
       p_min_reliability => $12, p_include_unrated => $13, p_only_matching => $14,
       p_sort => $15, p_limit => $16, p_offset => $17)'
  using coalesce((args->>'org')::uuid, pg_temp.cd('org_a')),
        (args->>'location')::uuid, (args->>'job')::uuid, args->>'q',
        (args->>'sport')::uuid, (args->>'lesson')::uuid, args->>'availability',
        (args->>'min_rating')::numeric, (args->>'min_experience')::integer,
        (args->>'max_distance')::integer, args->>'relation',
        (args->>'min_reliability')::integer,
        coalesce((args->>'include_unrated')::boolean, false),
        coalesce((args->>'only_matching')::boolean, false),
        coalesce(args->>'sort', 'match'),
        coalesce((args->>'limit')::integer, 50), coalesce((args->>'offset')::integer, 0);
end $$;
grant execute on function pg_temp.search(jsonb) to authenticated;

create type pg_temp.row_t as (
  user_id uuid, full_name text, avg_rating numeric, review_count bigint,
  reliability_score numeric, years_experience integer, distance_km numeric,
  match_job_id uuid, match_score integer, availability text, in_pool boolean,
  worked_before boolean, pending_application_job_id uuid, invited_pending boolean,
  applied_to_action_job boolean, invited_to_action_job boolean, has_valid_vog boolean,
  total_count bigint, page_offset integer
);

-- Typed view over pg_temp.search() for readable assertions.
create function pg_temp.s(args jsonb default '{}'::jsonb)
returns setof pg_temp.row_t language sql security invoker set search_path = '' as $$
  select * from pg_temp.search(args) as r(
    user_id uuid, full_name text, avg_rating numeric, review_count bigint,
    reliability_score numeric, years_experience integer, distance_km numeric,
    match_job_id uuid, match_score integer, availability text, in_pool boolean,
    worked_before boolean, pending_application_job_id uuid, invited_pending boolean,
    applied_to_action_job boolean, invited_to_action_job boolean, has_valid_vog boolean,
    total_count bigint, page_offset integer);
$$;
grant execute on function pg_temp.s(jsonb) to authenticated;

create function pg_temp.total(args jsonb default '{}'::jsonb) returns bigint
language sql security invoker set search_path = '' as $$
  select coalesce(max(total_count), 0) from pg_temp.s(args || '{"limit": 1}'::jsonb);
$$;
grant execute on function pg_temp.total(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into public.demo_sessions (id) values (pg_temp.cd('demo'));

insert into auth.users (id, email, raw_user_meta_data)
select pg_temp.cd(label), label || '@candidate-discovery.test',
       jsonb_build_object('role', role, 'full_name', name)
from (values
  ('owner', 'organization', 'Owner A'),
  ('invited_member', 'organization', 'Invited member A'),
  ('owner_b', 'organization', 'Owner B'),
  ('demo_owner', 'organization', 'Demo owner'),
  ('alpha', 'instructor', 'Alpha Kandidaat'),
  ('nieuw', 'instructor', 'Nieuwe Kandidaat'),
  ('bezet', 'instructor', 'Bezette Kandidaat'),
  ('conflict', 'instructor', 'Conflict Kandidaat'),
  ('far', 'instructor', 'Verre Kandidaat'),
  ('applicant', 'instructor', 'Reagerende Kandidaat'),
  ('invitee', 'instructor', 'Uitgenodigde Kandidaat'),
  ('novog', 'instructor', 'Geen Document'),
  ('novog_pool', 'instructor', 'Poule zonder VOG'),
  ('pct', 'instructor', 'Honderd%_Procent'),
  ('expired_pool', 'instructor', 'Verlopen VOG'),
  ('today_vog', 'instructor', 'Vandaag Geldig'),
  ('seg_conflict', 'instructor', 'Segment Bezet'),
  ('demo_instr', 'instructor', 'Demo Kandidaat')
) f(label, role, name);

insert into auth.users (id, email, raw_user_meta_data)
select pg_temp.cd('bulk_' || n), 'bulk-' || n || '@candidate-discovery.test',
       jsonb_build_object('role', 'instructor', 'full_name', 'Bulk ' || lpad(n::text, 3, '0'))
from generate_series(1, 120) n;

update public.profiles set demo_session_id = pg_temp.cd('demo')
where id in (pg_temp.cd('demo_owner'), pg_temp.cd('demo_instr'));

-- Locations and cities: Utrecht for the gym and most instructors, Amsterdam
-- (about 35 km) for the far instructor, a custom city for unknown distance.
update public.profiles set city_id = (select id from public.cities where name = 'Utrecht')
where id in (select pg_temp.cd(l) from unnest(array['alpha','bezet','conflict','applicant','invitee','novog','novog_pool','pct','demo_instr','expired_pool','today_vog','seg_conflict']) l)
   or id in (select pg_temp.cd('bulk_' || n) from generate_series(1, 120) n);
update public.profiles set city_id = (select id from public.cities where name = 'Amsterdam')
where id = pg_temp.cd('far');
update public.profiles set custom_city = 'Ergens Onbekend' where id = pg_temp.cd('nieuw');

select pg_temp.act_as('owner');
insert into public.instructor_profiles (user_id, years_experience, travel_distance_km)
select pg_temp.cd(label), years, travel
from (values ('alpha', 20, 30), ('nieuw', 0, 30), ('bezet', 4, 30), ('conflict', 6, 30),
             ('far', 8, 10), ('applicant', 3, 30), ('invitee', 2, 30), ('novog', 9, 30),
             ('novog_pool', 1, 30), ('pct', 5, 30), ('demo_instr', 5, 30),
             ('expired_pool', 3, 30), ('today_vog', 3, 30), ('seg_conflict', 3, 30)) f(label, years, travel);
insert into public.instructor_profiles (user_id, years_experience, travel_distance_km)
select pg_temp.cd('bulk_' || n), n % 15, 40 from generate_series(1, 120) n;

-- Everyone does fitness: well over 100 sport links for one sport.
insert into public.instructor_sports (user_id, sport_id)
select ip.user_id, (select id from public.sports where slug = 'fitness')
from public.instructor_profiles ip
where ip.user_id in (select pg_temp.cd(l) from unnest(array['alpha','nieuw','bezet','conflict','far','applicant','invitee','novog','novog_pool','pct','demo_instr','expired_pool','today_vog','seg_conflict']) l)
   or ip.user_id in (select pg_temp.cd('bulk_' || n) from generate_series(1, 120) n);
insert into public.instructor_sports (user_id, sport_id)
values (pg_temp.cd('alpha'), (select id from public.sports where slug = 'spinning'));
insert into public.instructor_lesson_types (user_id, lesson_type_id)
values (pg_temp.cd('alpha'), (select lt.id from public.lesson_types lt join public.sports s on s.id = lt.sport_id
                              where s.slug = 'fitness' and lt.name = 'Krachttraining'));

-- Valid VOG for everyone except novog and novog_pool.
insert into public.document_uploads (user_id, doc_type, storage_path, original_filename, status, expires_at)
select ip.user_id, 'vog', 'tests/candidates/' || ip.user_id || '.pdf', 'synthetic.pdf', 'approved', current_date + 365
from public.instructor_profiles ip
where ip.user_id not in (pg_temp.cd('novog'), pg_temp.cd('novog_pool'))
  and (ip.user_id in (select pg_temp.cd(l) from unnest(array['alpha','nieuw','bezet','conflict','far','applicant','invitee','pct','demo_instr','seg_conflict']) l)
       or ip.user_id in (select pg_temp.cd('bulk_' || n) from generate_series(1, 120) n));

-- VOG validity boundaries: expired yesterday (pool member) and valid until today.
insert into public.document_uploads (user_id, doc_type, storage_path, original_filename, status, expires_at)
values (pg_temp.cd('expired_pool'), 'vog', 'tests/candidates/expired.pdf', 'synthetic.pdf', 'approved',
        (now() at time zone 'Europe/Amsterdam')::date - 1),
       (pg_temp.cd('today_vog'), 'vog', 'tests/candidates/today.pdf', 'synthetic.pdf', 'approved',
        (now() at time zone 'Europe/Amsterdam')::date);

insert into public.organizations (id, name, org_type, created_by, demo_session_id)
values (pg_temp.cd('org_a'), 'Discovery A', 'gym', pg_temp.cd('owner'), null),
       (pg_temp.cd('org_b'), 'Discovery B', 'gym', pg_temp.cd('owner_b'), null),
       (pg_temp.cd('org_demo'), 'Discovery Demo', 'gym', pg_temp.cd('demo_owner'), pg_temp.cd('demo'));
insert into public.organization_members (organization_id, user_id, member_role, state)
values (pg_temp.cd('org_a'), pg_temp.cd('owner'), 'owner', 'active'),
       (pg_temp.cd('org_a'), pg_temp.cd('invited_member'), 'planner', 'invited'),
       (pg_temp.cd('org_b'), pg_temp.cd('owner_b'), 'owner', 'active'),
       (pg_temp.cd('org_demo'), pg_temp.cd('demo_owner'), 'owner', 'active');
insert into public.organization_locations (id, organization_id, name, city_id)
values (pg_temp.cd('loc_utrecht'), pg_temp.cd('org_a'), 'Utrecht', (select id from public.cities where name = 'Utrecht')),
       (pg_temp.cd('loc_amsterdam'), pg_temp.cd('org_a'), 'Amsterdam', (select id from public.cities where name = 'Amsterdam')),
       (pg_temp.cd('loc_b'), pg_temp.cd('org_b'), 'B', (select id from public.cities where name = 'Utrecht')),
       (pg_temp.cd('loc_demo'), pg_temp.cd('org_demo'), 'Demo', (select id from public.cities where name = 'Utrecht'));

-- Jobs: an open fitness job (target), a completed job (history/reviews),
-- another instructor's confirmed overlapping job (conflict) and org B's job.
insert into public.jobs (id, organization_id, location_id, created_by, job_type, sport_id,
                         lesson_type_id, title, starts_on, start_time, end_time, pay_type,
                         pay_hourly_rate_cents, status)
values
  (pg_temp.cd('job_open'), pg_temp.cd('org_a'), pg_temp.cd('loc_utrecht'), pg_temp.cd('owner'), 'one_time',
   (select id from public.sports where slug = 'fitness'), null, 'Open fitness',
   date '2030-06-05', '10:00', '11:00', 'hourly', 4500, 'open'),
  (pg_temp.cd('job_done'), pg_temp.cd('org_a'), pg_temp.cd('loc_utrecht'), pg_temp.cd('owner'), 'one_time',
   (select id from public.sports where slug = 'fitness'), null, 'Done fitness',
   current_date - 10, '10:00', '11:00', 'hourly', 4500, 'completed'),
  (pg_temp.cd('job_busy'), pg_temp.cd('org_a'), pg_temp.cd('loc_utrecht'), pg_temp.cd('owner'), 'one_time',
   (select id from public.sports where slug = 'fitness'), null, 'Busy fitness',
   date '2030-06-05', '10:30', '11:30', 'hourly', 4500, 'confirmed'),
  (pg_temp.cd('job_b'), pg_temp.cd('org_b'), pg_temp.cd('loc_b'), pg_temp.cd('owner_b'), 'one_time',
   (select id from public.sports where slug = 'fitness'), null, 'Org B fitness',
   date '2030-06-05', '10:00', '11:00', 'hourly', 4500, 'open');

insert into public.job_applications (id, job_id, instructor_id, status)
values (pg_temp.cd('app_done'), pg_temp.cd('job_done'), pg_temp.cd('alpha'), 'accepted'),
       (pg_temp.cd('app_busy'), pg_temp.cd('job_busy'), pg_temp.cd('conflict'), 'accepted'),
       (pg_temp.cd('app_open'), pg_temp.cd('job_open'), pg_temp.cd('applicant'), 'pending');
insert into public.job_confirmations (job_id, application_id, instructor_id, organization_agreed_at,
                                      instructor_agreed_at, confirmed_at)
values (pg_temp.cd('job_done'), pg_temp.cd('app_done'), pg_temp.cd('alpha'), now(), now(), now()),
       (pg_temp.cd('job_busy'), pg_temp.cd('app_busy'), pg_temp.cd('conflict'), now(), now(), now());
insert into public.reviews (job_id, reviewer_id, reviewee_id, side, rating, released_at)
values (pg_temp.cd('job_done'), pg_temp.cd('owner'), pg_temp.cd('alpha'), 'organization', 5, now()),
       (pg_temp.cd('job_done'), pg_temp.cd('alpha'), pg_temp.cd('owner'), 'instructor', 4, now());
insert into public.job_invitations (job_id, instructor_id, invited_by)
values (pg_temp.cd('job_open'), pg_temp.cd('invitee'), pg_temp.cd('owner'));
insert into public.organization_instructor_connections (organization_id, instructor_id, created_by)
values (pg_temp.cd('org_a'), pg_temp.cd('novog_pool'), pg_temp.cd('owner')),
       (pg_temp.cd('org_a'), pg_temp.cd('bulk_7'), pg_temp.cd('owner'));

insert into public.jobs (id, organization_id, location_id, created_by, job_type, sport_id,
                         title, starts_on, start_time, end_time, pay_type, pay_hourly_rate_cents, status)
values (pg_temp.cd('job_block'), pg_temp.cd('org_b'), pg_temp.cd('loc_b'), pg_temp.cd('owner_b'), 'one_time',
        (select id from public.sports where slug = 'fitness'), 'Org B block',
        date '2030-06-05', '09:00', '12:00', 'hourly', 4500, 'closed');
insert into public.job_segments (id, job_id, position, start_time, end_time)
values (pg_temp.cd('seg_1'), pg_temp.cd('job_block'), 1, '10:15', '10:45');
insert into public.job_applications (id, job_id, instructor_id, status)
values (pg_temp.cd('app_block'), pg_temp.cd('job_block'), pg_temp.cd('seg_conflict'), 'accepted');
insert into public.job_application_segments (application_id, segment_id)
values (pg_temp.cd('app_block'), pg_temp.cd('seg_1'));
insert into public.job_segment_confirmations (job_id, segment_id, application_id, instructor_id,
                                              organization_agreed_by, confirmed_at)
values (pg_temp.cd('job_block'), pg_temp.cd('seg_1'), pg_temp.cd('app_block'), pg_temp.cd('seg_conflict'),
        pg_temp.cd('owner_b'), now());
insert into public.organization_instructor_connections (organization_id, instructor_id, created_by)
values (pg_temp.cd('org_a'), pg_temp.cd('expired_pool'), pg_temp.cd('owner'));

-- Weekly availability (2030-06-05 is a Wednesday, dow 3).
insert into public.availability_rules (user_id, weekday, start_time, end_time)
values (pg_temp.cd('alpha'), 3, '08:00', '12:00'),
       (pg_temp.cd('bezet'), 1, '08:00', '12:00'),
       (pg_temp.cd('conflict'), 3, '08:00', '12:00');

-- ---------------------------------------------------------------------------
-- API surface and privacy of the result shape
-- ---------------------------------------------------------------------------
reset role;
do $$
declare
  v_fn regprocedure := 'public.search_organization_candidates(uuid,uuid,uuid,text,uuid,uuid,text,numeric,integer,integer,text,integer,boolean,boolean,text,integer,integer)';
begin
  perform pg_temp.check((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                         where n.nspname = 'public' and p.proname = 'search_organization_candidates') = 1,
                        'search_organization_candidates must not have overloads');
  perform pg_temp.check((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = v_fn),
                        'search must be SECURITY DEFINER with an empty search_path');
  perform pg_temp.check(not has_function_privilege('anon', v_fn, 'EXECUTE')
                        and not has_function_privilege('public', v_fn, 'EXECUTE')
                        and has_function_privilege('authenticated', v_fn, 'EXECUTE'),
                        'search grants are wrong');
  perform pg_temp.check(not exists (
      select 1 from unnest((select proargnames from pg_proc where oid = v_fn)) name
      where name in ('age', 'hourly_rate_cents', 'storage_path', 'work_experience')
         or name ~* '(birth|kvk|btw|phone|email|contact|address|document)'),
    'search returns private fields');
end $$;

set role authenticated;

-- ---------------------------------------------------------------------------
-- Authorization and parameter manipulation
-- ---------------------------------------------------------------------------
select pg_temp.act_as('alpha');
select pg_temp.expect_error($$select * from pg_temp.s()$$, '42501', 'Geen toegang');
select pg_temp.act_as('invited_member');
select pg_temp.expect_error($$select * from pg_temp.s()$$, '42501', 'Geen toegang');
select pg_temp.act_as('owner_b');
select pg_temp.expect_error($$select * from pg_temp.s()$$, '42501', 'Geen toegang');
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.expect_error($$select * from pg_temp.s()$$, '42501', 'Geen toegang');

select pg_temp.act_as('owner');
select pg_temp.expect_error(format($$select * from pg_temp.s('{"job": "%s"}')$$, pg_temp.cd('job_b')),
                            '42501', 'Opdracht niet gevonden');
select pg_temp.expect_error(format($$select * from pg_temp.s('{"job": "%s"}')$$, pg_temp.cd('job_done')),
                            '42501', 'Opdracht niet gevonden');
select pg_temp.expect_error(format($$select * from pg_temp.s('{"location": "%s"}')$$, pg_temp.cd('loc_b')),
                            '42501', 'Vestiging niet gevonden');
select pg_temp.expect_error(format($$select * from pg_temp.s('{"location": "%s", "job": "%s"}')$$,
                                   pg_temp.cd('loc_amsterdam'), pg_temp.cd('job_open')),
                            '42501', 'Opdracht niet gevonden');
select pg_temp.expect_error($$select * from pg_temp.s('{"sort": "name; drop table x"}')$$, '22023', 'Onbekende sortering');
select pg_temp.expect_error($$select * from pg_temp.s('{"min_rating": 6}')$$, '22023', 'Ongeldige filterwaarde');
select pg_temp.expect_error($$select * from pg_temp.s('{"min_experience": -1}')$$, '22023', 'Ongeldige filterwaarde');
select pg_temp.expect_error($$select * from pg_temp.s('{"max_distance": 0}')$$, '22023', 'Ongeldige filterwaarde');
select pg_temp.expect_error($$select * from pg_temp.s('{"min_reliability": 101}')$$, '22023', 'Ongeldige filterwaarde');
select pg_temp.expect_error($$select * from pg_temp.s('{"relation": "everyone"}')$$, '22023', 'Onbekende relatie');
select pg_temp.expect_error($$select * from pg_temp.s('{"availability": "available"}')$$, '22023', 'Kies een opdracht');
select pg_temp.expect_error(format($$select * from pg_temp.s('{"job": "%s", "availability": "yes"}')$$, pg_temp.cd('job_open')),
                            '22023', 'Onbekende beschikbaarheid');

-- ---------------------------------------------------------------------------
-- Complete set: more than 100 sport links, correct totals, stable paging
-- ---------------------------------------------------------------------------
do $$
declare
  v_expected bigint;
  v_total bigint;
  v_seen uuid[] := '{}';
  v_page uuid[];
  v_offset integer := 0;
begin
  perform pg_temp.check(
    (select count(*) from public.instructor_sports s join public.sports sp on sp.id = s.sport_id
     where sp.slug = 'fitness') > 100, 'fixture needs more than 100 sport links');

  -- Ground truth: in-scope instructors with a valid VOG or a relation to org A.
  -- bulk + alpha, nieuw, bezet, conflict, far, applicant, invitee, pct,
  -- today_vog, seg_conflict (valid VOG) + novog_pool, expired_pool (pool).
  v_expected := 120 + 12;
  v_total := pg_temp.total();
  perform pg_temp.check(v_total = v_expected,
    format('total %s, expected %s', v_total, v_expected));
  perform pg_temp.check(pg_temp.total(format('{"sport": "%s"}',
    (select id from public.sports where slug = 'fitness'))::jsonb) = v_expected,
    'sport filter does not cover every linked instructor');

  -- Page through the whole set in pages of 20 for every sort order.
  declare
    v_sort text;
  begin
    foreach v_sort in array array['match', 'rating', 'reliability', 'experience', 'distance'] loop
      v_seen := '{}';
      v_offset := 0;
      while v_offset < v_total loop
        select array_agg(user_id) into v_page
        from pg_temp.s(jsonb_build_object('sort', v_sort, 'limit', 20, 'offset', v_offset));
        perform pg_temp.check(cardinality(v_page) <= 20, 'page larger than limit');
        perform pg_temp.check(not (v_seen && v_page), format('duplicate across pages (%s)', v_sort));
        v_seen := v_seen || v_page;
        v_offset := v_offset + 20;
      end loop;
      perform pg_temp.check(cardinality(v_seen) = v_total,
        format('paging (%s) returned %s of %s', v_sort, cardinality(v_seen), v_total));
    end loop;
  end;

  -- Out-of-range offsets clamp to the last page instead of an empty result.
  perform pg_temp.check(
    (select min(page_offset) from pg_temp.s('{"limit": 20, "offset": 100000}')) = ((v_total - 1) / 20) * 20,
    'out-of-range offset not clamped to the last page');
  perform pg_temp.check(
    (select count(*) from pg_temp.s('{"limit": 1000}')) = 50, 'limit not capped at 50');
end $$;

-- ---------------------------------------------------------------------------
-- Membership of the candidate set, privacy of absent candidates
-- ---------------------------------------------------------------------------
do $$ begin
  perform pg_temp.check(not exists (select 1 from pg_temp.s('{"limit": 50, "q": "Geen Document"}')),
    'instructor without VOG or relation is listed');
  perform pg_temp.check((select not has_valid_vog and in_pool from pg_temp.s('{"q": "Poule zonder"}')),
    'pool member without VOG missing or VOG flag wrong');
  perform pg_temp.check(not exists (select 1 from pg_temp.s('{"q": "Demo Kandidaat"}')),
    'demo instructor visible to production organization');
  perform pg_temp.check((select count(*) from pg_temp.s('{"q": "alpha"}')) = 1,
    'name search is not case-insensitive/partial');
  perform pg_temp.check((select count(*) from pg_temp.s('{"q": "  Alpha Kand  "}')) = 1,
    'name search does not trim');
  perform pg_temp.check((select count(*) from pg_temp.s('{"q": "%"}')) = 1
                        and (select full_name from pg_temp.s('{"q": "%"}')) = 'Honderd%_Procent',
    'percent sign is not matched literally');
  perform pg_temp.check((select count(*) from pg_temp.s('{"q": "d%_P"}')) = 1
                        and (select count(*) from pg_temp.s('{"q": "_"}')) = 1,
    'underscore is not matched literally');
end $$;

select pg_temp.act_as('demo_owner');
do $$ begin
  perform pg_temp.check(
    (select array_agg(full_name) from public.search_organization_candidates(pg_temp.cd('org_demo')))
      = array['Demo Kandidaat'],
    'demo organization does not see exactly its own demo instructor');
end $$;
select pg_temp.act_as('owner');

-- ---------------------------------------------------------------------------
-- Relations, matching, availability and distance
-- ---------------------------------------------------------------------------
do $$
declare
  v_job uuid := pg_temp.cd('job_open');
  r pg_temp.row_t;
begin
  select * into r from pg_temp.s('{"q": "Reagerende"}');
  perform pg_temp.check(r.pending_application_job_id = v_job, 'applicant relation missing');
  select * into r from pg_temp.s('{"q": "Uitgenodigde"}');
  perform pg_temp.check(r.invited_pending and r.invited_to_action_job, 'invitation relation missing');
  select * into r from pg_temp.s('{"q": "Alpha"}');
  perform pg_temp.check(r.worked_before and r.review_count = 1 and r.avg_rating = 5,
    'history/review of alpha missing');

  perform pg_temp.check(pg_temp.total('{"relation": "pool"}') = 3, 'pool relation count');
  perform pg_temp.check(pg_temp.total('{"relation": "worked"}') = 1, 'worked relation count');
  perform pg_temp.check(pg_temp.total('{"relation": "applied"}') = 1, 'applied relation count');
  perform pg_temp.check(pg_temp.total('{"relation": "invited"}') = 1, 'invited relation count');

  -- Selected job: explicit availability states, never guessed.
  perform pg_temp.check((select availability from pg_temp.s(jsonb_build_object('job', v_job, 'q', 'Alpha'))) = 'available',
    'rule-covered instructor not available');
  perform pg_temp.check((select availability from pg_temp.s(jsonb_build_object('job', v_job, 'q', 'Nieuwe'))) = 'unknown',
    'instructor without availability data not unknown');
  perform pg_temp.check((select availability from pg_temp.s(jsonb_build_object('job', v_job, 'q', 'Bezette'))) = 'unavailable',
    'instructor outside weekly rules not unavailable');
  perform pg_temp.check((select availability from pg_temp.s(jsonb_build_object('job', v_job, 'q', 'Conflict'))) = 'unavailable',
    'instructor with confirmed overlapping job not unavailable');
  perform pg_temp.check(
    pg_temp.total(jsonb_build_object('job', v_job, 'availability', 'available'))
      + pg_temp.total(jsonb_build_object('job', v_job, 'availability', 'unknown'))
      + pg_temp.total(jsonb_build_object('job', v_job, 'availability', 'unavailable'))
      = pg_temp.total(jsonb_build_object('job', v_job)),
    'availability states do not partition the result');
  perform pg_temp.check((select availability from pg_temp.s(jsonb_build_object('job', v_job, 'q', 'Segment Bezet'))) = 'unavailable',
    'instructor with confirmed overlapping segment not unavailable');
  perform pg_temp.check(pg_temp.total(jsonb_build_object('job', v_job, 'availability', 'unavailable')) = 3,
    'unexpected unavailable count');

  -- Matching: new instructors are not excluded, unknown distance is neutral,
  -- out-of-radius and unavailable instructors do not match but stay listed.
  select * into r from pg_temp.s(jsonb_build_object('job', v_job, 'q', 'Nieuwe'));
  perform pg_temp.check(r.match_job_id = v_job and r.match_score is not null and r.distance_km is null,
    'new instructor with unknown distance not matched');
  select * into r from pg_temp.s(jsonb_build_object('job', v_job, 'q', 'Verre'));
  perform pg_temp.check(r.match_job_id is null and r.distance_km > 10, 'out-of-radius instructor matched');
  perform pg_temp.check((select match_job_id is null from pg_temp.s(jsonb_build_object('job', v_job, 'q', 'Bezette'))),
    'unavailable instructor matched');
  perform pg_temp.check(not exists (select 1 from pg_temp.s(jsonb_build_object('job', v_job, 'q', 'Verre', 'only_matching', true))),
    'only-matching filter keeps non-matching instructor');
  -- Without a selected job the best open job is used for matching.
  perform pg_temp.check((select match_job_id from pg_temp.s('{"q": "Alpha"}')) = v_job,
    'best open job not used without selected job');
  perform pg_temp.check((select availability from pg_temp.s('{"q": "Verre"}')) is null,
    'availability shown without a job context');

  -- Distance filter keeps only known distances within the limit.
  perform pg_temp.check(not exists (select 1 from pg_temp.s('{"max_distance": 25}') where distance_km is null or distance_km > 25),
    'distance filter includes unknown or far instructors');
  perform pg_temp.check(not exists (select 1 from pg_temp.s('{"max_distance": 25, "q": "Nieuwe"}')),
    'unknown distance treated as zero');
end $$;

-- ---------------------------------------------------------------------------
-- Filters and combinations
-- ---------------------------------------------------------------------------
do $$
declare
  v_kracht uuid := (select lt.id from public.lesson_types lt join public.sports s on s.id = lt.sport_id
                    where s.slug = 'fitness' and lt.name = 'Krachttraining');
  v_spinning uuid := (select id from public.sports where slug = 'spinning');
begin
  perform pg_temp.check((select array_agg(full_name) from pg_temp.s(jsonb_build_object('sport', v_spinning))) = array['Alpha Kandidaat'],
    'sport filter');
  perform pg_temp.check((select array_agg(full_name) from pg_temp.s(jsonb_build_object('lesson', v_kracht))) = array['Alpha Kandidaat'],
    'lesson type filter');
  perform pg_temp.check(not exists (select 1 from pg_temp.s('{"min_experience": 10}') where years_experience < 10),
    'experience filter');
  perform pg_temp.check(pg_temp.total('{"min_experience": 10}') =
    (select count(*) from pg_temp.s('{"limit": 50, "min_experience": 10}')), 'experience total');
  -- Rating filter: unrated instructors are excluded unless explicitly included.
  perform pg_temp.check((select array_agg(full_name) from pg_temp.s('{"min_rating": 4}')) = array['Alpha Kandidaat'],
    'minimum rating filter');
  perform pg_temp.check(pg_temp.total('{"min_rating": 4, "include_unrated": true}') = pg_temp.total(),
    'include unrated does not add instructors without reviews');
  perform pg_temp.check(pg_temp.total('{"min_reliability": 50}') = 1,
    'reliability filter on known scores');
  -- Conflict Kandidaat and Segment Bezet have a known, low score (32: confirmed
  -- but not completed) and stay excluded.
  perform pg_temp.check(pg_temp.total('{"min_reliability": 50, "include_unrated": true}') = pg_temp.total() - 2,
    'include unrated does not add (only) instructors without history');
  -- Combination: fitness + experience + pool + name.
  perform pg_temp.check(
    (select array_agg(full_name) from pg_temp.s(jsonb_build_object(
      'sport', (select id from public.sports where slug = 'fitness'),
      'min_experience', 5, 'relation', 'pool', 'q', 'bulk'))) = array['Bulk 007'],
    'combined filters');
  perform pg_temp.check(pg_temp.total(jsonb_build_object(
      'sport', (select id from public.sports where slug = 'fitness'),
      'min_experience', 8, 'relation', 'pool')) = 0,
    'combined filters with no result');
end $$;

-- ---------------------------------------------------------------------------
-- Sorting: chosen key, unknown values last, stable tie-breakers
-- ---------------------------------------------------------------------------
do $$
declare
  v_job uuid := pg_temp.cd('job_open');
begin
  perform pg_temp.check((select full_name from pg_temp.s('{"sort": "rating", "limit": 1}')) = 'Alpha Kandidaat',
    'rating sort does not put the rated instructor first');
  perform pg_temp.check((select full_name from pg_temp.s('{"sort": "reliability", "limit": 1}')) = 'Alpha Kandidaat',
    'reliability sort does not put the known score first');
  perform pg_temp.check((select full_name from pg_temp.s('{"sort": "experience", "limit": 1}')) = 'Alpha Kandidaat',
    'experience sort');
  perform pg_temp.check(not exists (
      select 1 from (select years_experience, lag(years_experience) over (order by ordinality) prev
                     from pg_temp.s('{"sort": "experience", "limit": 50}') with ordinality) x
      where x.years_experience > x.prev), 'experience not descending');
  perform pg_temp.check(not exists (
      select 1 from (select distance_km, lag(distance_km) over (order by ordinality) prev,
                            bool_or(distance_km is null) over (order by ordinality rows between unbounded preceding and 1 preceding) null_seen
                     from pg_temp.s('{"sort": "distance", "limit": 50, "offset": 100}') with ordinality) x
      where (x.distance_km is not null and x.null_seen) or x.distance_km < x.prev),
    'distance not ascending with unknown last');
  perform pg_temp.check(
    (select full_name from pg_temp.s(jsonb_build_object('sort', 'distance', 'limit', 1, 'offset', pg_temp.total() - 1)))
      = 'Nieuwe Kandidaat', 'unknown distance not sorted last');
  perform pg_temp.check(not exists (
      select 1 from (select match_score, lag(match_score) over (order by ordinality) prev,
                            bool_or(match_score is null) over (order by ordinality rows between unbounded preceding and 1 preceding) null_seen
                     from pg_temp.s(jsonb_build_object('job', v_job, 'limit', 50)) with ordinality) x
      where (x.match_score is not null and x.null_seen) or x.match_score > x.prev),
    'match sort not descending with non-matching last');
  -- Ties: name, then id. Bulk instructors share most values.
  perform pg_temp.check(
    (select array_agg(full_name order by ordinality) from pg_temp.s('{"q": "Bulk 00", "sort": "rating"}') with ordinality)
      = array['Bulk 001','Bulk 002','Bulk 003','Bulk 004','Bulk 005','Bulk 006','Bulk 007','Bulk 008','Bulk 009'],
    'secondary sort by name not stable');
  -- Same request twice gives the same order.
  perform pg_temp.check(
    (select array_agg(user_id order by ordinality) from pg_temp.s('{"limit": 50}') with ordinality)
      = (select array_agg(user_id order by ordinality) from pg_temp.s('{"limit": 50}') with ordinality),
    'order is not deterministic');
end $$;

-- ---------------------------------------------------------------------------
-- Parity with the canonical VOG and schedule-conflict checks (run as the
-- table owner with the owner's identity, so private helpers are callable).
-- ---------------------------------------------------------------------------
reset role;
do $$
declare
  r record;
  v_job uuid := pg_temp.cd('job_open');
begin
  perform pg_temp.check(
    (select not has_valid_vog from pg_temp.s('{"q": "Verlopen VOG"}'))
    and (select has_valid_vog from pg_temp.s('{"q": "Vandaag Geldig"}')),
    'VOG validity boundary');
  for r in select s.user_id, s.has_valid_vog, s.availability
           from pg_temp.s(jsonb_build_object('job', v_job, 'limit', 50, 'sort', 'distance', 'offset', 0)) s
           union all
           select s.user_id, s.has_valid_vog, s.availability
           from pg_temp.s(jsonb_build_object('job', v_job, 'q', 'e')) s
  loop
    perform pg_temp.check(r.has_valid_vog = private.has_valid_vog(r.user_id),
      'VOG flag differs from private.has_valid_vog for ' || r.user_id);
    perform pg_temp.check(
      not public.instructor_has_schedule_conflict(r.user_id, v_job, '10:00', '11:00')
      or r.availability = 'unavailable',
      'schedule conflict not reflected for ' || r.user_id);
  end loop;
end $$;
set role authenticated;

-- ---------------------------------------------------------------------------
-- Statistics parity with instructor_public_stats
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select s.user_id, s.avg_rating, s.review_count, s.reliability_score
    from pg_temp.s('{"limit": 50, "sort": "rating"}') s
  loop
    perform pg_temp.check(
      (select st.avg_rating is not distinct from r.avg_rating
              and st.review_count = r.review_count
              and st.reliability_score is not distinct from r.reliability_score
       from public.instructor_public_stats(r.user_id) st),
      'statistics differ from instructor_public_stats for ' || r.user_id);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Applicant summaries for the inbox: more than 200 pending applicants in one
-- call, scoped, authorized and with the same statistics.
-- ---------------------------------------------------------------------------
reset role;
insert into public.jobs (id, organization_id, location_id, created_by, job_type, sport_id,
                         title, starts_on, start_time, end_time, pay_type, pay_hourly_rate_cents, status)
values (pg_temp.cd('job_many'), pg_temp.cd('org_a'), pg_temp.cd('loc_utrecht'), pg_temp.cd('owner'), 'one_time',
        (select id from public.sports where slug = 'fitness'), 'Many applicants',
        date '2030-07-03', '18:00', '19:00', 'hourly', 4500, 'open');
insert into auth.users (id, email, raw_user_meta_data)
select pg_temp.cd('app_' || n), 'app-' || n || '@candidate-discovery.test',
       jsonb_build_object('role', 'instructor', 'full_name', 'Applicant ' || lpad(n::text, 3, '0'))
from generate_series(1, 130) n;
insert into public.instructor_profiles (user_id)
select pg_temp.cd('app_' || n) from generate_series(1, 130) n;
-- 120 bulk + 130 new + alpha (reviews) + conflict (low reliability) pending;
-- far withdrawn; the demo instructor's (cross-scope) application is ignored.
insert into public.job_applications (job_id, instructor_id, status)
select pg_temp.cd('job_many'), uid, 'pending'
from (select pg_temp.cd('bulk_' || n) as uid from generate_series(1, 120) n
      union all select pg_temp.cd('app_' || n) from generate_series(1, 130) n
      union all select pg_temp.cd('alpha')
      union all select pg_temp.cd('conflict')) applicants;
insert into public.job_applications (job_id, instructor_id, status)
values (pg_temp.cd('job_many'), pg_temp.cd('far'), 'withdrawn'),
       (pg_temp.cd('job_many'), pg_temp.cd('demo_instr'), 'pending');

do $$
declare
  v_fn regprocedure := 'public.organization_applicant_summaries(uuid,uuid[])';
begin
  perform pg_temp.check((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                         where n.nspname = 'public' and p.proname = 'organization_applicant_summaries') = 1,
                        'organization_applicant_summaries must not have overloads');
  perform pg_temp.check((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = v_fn),
                        'applicant summaries must be SECURITY DEFINER with an empty search_path');
  perform pg_temp.check(not has_function_privilege('anon', v_fn, 'EXECUTE')
                        and not has_function_privilege('public', v_fn, 'EXECUTE')
                        and has_function_privilege('authenticated', v_fn, 'EXECUTE'),
                        'applicant summary grants are wrong');
  perform pg_temp.check(not has_function_privilege('authenticated', 'private.instructor_stats(uuid[])', 'EXECUTE')
                        and not has_function_privilege('anon', 'private.instructor_stats(uuid[])', 'EXECUTE'),
                        'internal statistics helper is executable by clients');
  perform pg_temp.check(not exists (
      select 1 from unnest((select proargnames from pg_proc where oid = v_fn)) name
      where name in ('age', 'hourly_rate_cents', 'storage_path', 'work_experience', 'city_name')
         or name ~* '(birth|kvk|btw|phone|email|contact|address|document)'),
    'applicant summaries return private fields');
end $$;

-- All pending applicant ids of org A, newest application first, as the
-- application pages them; summaries are requested per page of ids.
create function pg_temp.applicant_ids(p_limit integer, p_offset integer) returns uuid[]
language sql security invoker set search_path = '' as $$
  select coalesce(array_agg(instructor_id order by created_at desc, id desc), '{}')
  from (select a.instructor_id, a.created_at, a.id
        from public.job_applications a join public.jobs j on j.id = a.job_id
        where j.organization_id = pg_temp.cd('org_a') and a.status = 'pending'
        order by a.created_at desc, a.id desc
        limit p_limit offset p_offset) page;
$$;
grant execute on function pg_temp.applicant_ids(integer, integer) to authenticated;

set role authenticated;
select pg_temp.act_as('alpha');
select pg_temp.expect_error(format($$select * from public.organization_applicant_summaries(%L, array[%L]::uuid[])$$,
                                   pg_temp.cd('org_a'), pg_temp.cd('bulk_1')), '42501', 'Geen toegang');
select pg_temp.act_as('invited_member');
select pg_temp.expect_error(format($$select * from public.organization_applicant_summaries(%L, array[%L]::uuid[])$$,
                                   pg_temp.cd('org_a'), pg_temp.cd('bulk_1')), '42501', 'Geen toegang');
select pg_temp.act_as('owner_b');
select pg_temp.expect_error(format($$select * from public.organization_applicant_summaries(%L, array[%L]::uuid[])$$,
                                   pg_temp.cd('org_a'), pg_temp.cd('bulk_1')), '42501', 'Geen toegang');
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.expect_error(format($$select * from public.organization_applicant_summaries(%L, array[%L]::uuid[])$$,
                                   pg_temp.cd('org_a'), pg_temp.cd('bulk_1')), '42501', 'Geen toegang');
select pg_temp.act_as('owner');
-- Responses are bounded: one inbox page of ids, never an unbounded list.
select pg_temp.expect_error(format($$select * from public.organization_applicant_summaries(%L, null)$$,
                                   pg_temp.cd('org_a')), '22023', 'maximaal 100');
select pg_temp.expect_error(format($$select * from public.organization_applicant_summaries(%L, %L::uuid[])$$,
                                   pg_temp.cd('org_a'), pg_temp.applicant_ids(101, 0)), '22023', 'maximaal 100');

do $$
declare
  v_org uuid := pg_temp.cd('org_a');
  v_seen uuid[] := '{}';
  v_page uuid[];
  v_offset integer := 0;
begin
  -- Page through all 253 pending applicants (250 + alpha + conflict on
  -- job_many, the earlier applicant on job_open) in pages of 100 ids.
  loop
    v_page := pg_temp.applicant_ids(100, v_offset);
    exit when cardinality(v_page) = 0;
    -- The synthetic cross-scope application of the demo instructor is the
    -- only id that must not be summarised.
    perform pg_temp.check(
      (select count(*) from public.organization_applicant_summaries(v_org, v_page))
        = (select count(distinct x) from unnest(v_page) x where x <> pg_temp.cd('demo_instr')),
      'page summaries incomplete at offset ' || v_offset);
    v_seen := v_seen || (select array_agg(user_id) from public.organization_applicant_summaries(v_org, v_page));
    v_offset := v_offset + 100;
  end loop;
  perform pg_temp.check(cardinality(v_seen) = 253
                        and (select count(distinct x) from unnest(v_seen) x) = 253,
    'not every pending applicant is reachable page by page');

  -- Only requested ids that really applied, inside the scope, are returned.
  perform pg_temp.check(
    (select count(*) from public.organization_applicant_summaries(
       v_org, array[pg_temp.cd('bulk_1'), pg_temp.cd('bulk_1'), pg_temp.cd('far'), pg_temp.cd('demo_instr'),
                    pg_temp.cd('nieuw'), pg_temp.cd('owner'), null])) = 1,
    'withdrawn, cross-scope, non-applicant, duplicate or null ids returned');
  perform pg_temp.check(not exists (select 1 from public.organization_applicant_summaries(v_org, '{}')),
    'empty id list returns rows');
  perform pg_temp.check(
    (select bool_and(in_pool = (user_id = pg_temp.cd('bulk_7')))
     from public.organization_applicant_summaries(v_org, array[pg_temp.cd('bulk_7'), pg_temp.cd('bulk_8')])),
    'pool flag');
  perform pg_temp.check(
    (select avg_rating = 5 and review_count = 1 and reliability_score = 100
     from public.organization_applicant_summaries(v_org, array[pg_temp.cd('alpha')])),
    'alpha statistics');
  perform pg_temp.check(
    (select avg_rating is null and review_count = 0 and reliability_score = 32
     from public.organization_applicant_summaries(v_org, array[pg_temp.cd('conflict')])),
    'known low reliability without reviews');
  perform pg_temp.check(
    (select count(*) from public.organization_applicant_summaries(v_org, pg_temp.applicant_ids(100, 0))
     where avg_rating is null and reliability_score is null and review_count = 0) >= 98,
    'unknown statistics must stay NULL, never 0');
end $$;

-- Parity with instructor_public_stats for every applicant, page by page.
do $$
declare
  r record;
  v_offset integer := 0;
begin
  while v_offset < 253 loop
    for r in select * from public.organization_applicant_summaries(
               pg_temp.cd('org_a'), pg_temp.applicant_ids(100, v_offset)) loop
      perform pg_temp.check(
        (select st.avg_rating is not distinct from r.avg_rating
                and st.review_count = r.review_count
                and st.completed_count = r.completed_count
                and st.reliability_score is not distinct from r.reliability_score
         from public.instructor_public_stats(r.user_id) st),
        'applicant statistics differ from instructor_public_stats for ' || r.user_id);
    end loop;
    v_offset := v_offset + 100;
  end loop;
end $$;

-- A demo organization only sees applicants inside its own demo, even when it
-- asks for production instructor ids.
select pg_temp.act_as('demo_owner');
do $$ begin
  perform pg_temp.check(not exists (
      select 1 from public.organization_applicant_summaries(
        pg_temp.cd('org_demo'), array[pg_temp.cd('bulk_1'), pg_temp.cd('alpha'), pg_temp.cd('demo_instr')])),
    'demo organization sees applicants of another scope');
end $$;

reset role;
rollback;
select 'CANDIDATE DISCOVERY TESTS GESLAAGD' as resultaat;
