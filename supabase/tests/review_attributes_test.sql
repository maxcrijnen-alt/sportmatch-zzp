-- Review attributes: RPC validation, database constraint, double-blind release
-- and access control. Isolated synthetic fixtures inside one rolled-back
-- transaction; never execute test files against production.
\set ON_ERROR_STOP on
begin;

create function pg_temp.rid(label text) returns uuid language sql immutable
as $$ select md5('review-attributes-2026-11-15-' || label)::uuid $$;
grant execute on function pg_temp.rid(text) to authenticated;

create function pg_temp.check(condition boolean, label text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if condition is distinct from true then
    raise exception 'FAIL: %', label;
  end if;
end $$;
grant execute on function pg_temp.check(boolean, text) to authenticated;

create function pg_temp.expect_error(statement text, expected text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  execute statement;
  raise exception 'FAIL: statement was accepted: %', statement;
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  if position(expected in sqlerrm) = 0 then
    raise exception 'FAIL: expected "%", got "%"', expected, sqlerrm;
  end if;
end $$;
grant execute on function pg_temp.expect_error(text, text) to authenticated;

create function pg_temp.act_as(label text) returns void
language sql security invoker set search_path = '' as $$
  select set_config('request.jwt.claim.sub', pg_temp.rid(label)::text, false);
$$;
grant execute on function pg_temp.act_as(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Fixtures: one gym, three instructors, an admin and a demo user.
-- whole:    completed whole-job assignment (instructor_a)
-- block:    completed lesson block with two instructors (a and b)
-- legacy:   completed job with reviews that predate attributes
-- upcoming: not completed yet
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data)
select pg_temp.rid(label), label || '@review-attributes.test',
       jsonb_build_object('role', role, 'full_name', 'Synthetic ' || label)
from (values ('owner', 'organization'), ('instructor_a', 'instructor'),
             ('instructor_b', 'instructor'), ('outsider', 'instructor'),
             ('outsider_org', 'organization'), ('admin', 'instructor'),
             ('demo_user', 'instructor')) f(label, role);
update public.profiles set role = 'admin' where id = pg_temp.rid('admin');
insert into public.demo_sessions (id) values (pg_temp.rid('demo_session'));
update public.profiles set demo_session_id = pg_temp.rid('demo_session')
where id = pg_temp.rid('demo_user');

select pg_temp.act_as('owner');
insert into public.instructor_profiles (user_id)
select pg_temp.rid(label)
from (values ('instructor_a'), ('instructor_b'), ('outsider'), ('demo_user')) f(label);
insert into public.organizations (id, name, org_type, created_by)
values (pg_temp.rid('org'), 'Review attributes gym', 'gym', pg_temp.rid('owner'));
insert into public.organization_members (organization_id, user_id, member_role)
values (pg_temp.rid('org'), pg_temp.rid('owner'), 'owner');
insert into public.organization_locations (id, organization_id, name, city_id)
values (pg_temp.rid('location'), pg_temp.rid('org'), 'Review attributes',
        (select id from public.cities where name = 'Utrecht'));
insert into public.jobs (id, organization_id, location_id, created_by, job_type,
                         sport_id, title, starts_on, start_time, end_time,
                         pay_type, pay_hourly_rate_cents, status)
select pg_temp.rid(label), pg_temp.rid('org'), pg_temp.rid('location'),
       pg_temp.rid('owner'), 'one_time',
       (select id from public.sports where slug = 'fitness'), label,
       current_date - 3, '10:00', '11:00', 'hourly', 4500,
       status::public.job_status
from (values ('whole', 'completed'), ('block', 'completed'),
             ('legacy', 'completed'), ('upcoming', 'confirmed')) f(label, status);
insert into public.job_applications (id, job_id, instructor_id)
select pg_temp.rid(job || '_' || instructor), pg_temp.rid(job), pg_temp.rid(instructor)
from (values ('whole', 'instructor_a'), ('legacy', 'instructor_a'),
             ('upcoming', 'instructor_a'), ('block', 'instructor_a'),
             ('block', 'instructor_b')) f(job, instructor);
insert into public.job_confirmations (job_id, application_id, instructor_id,
                                      organization_agreed_at, instructor_agreed_at,
                                      confirmed_at)
select pg_temp.rid(job), pg_temp.rid(job || '_instructor_a'),
       pg_temp.rid('instructor_a'), now(), now(), now()
from (values ('whole'), ('legacy'), ('upcoming')) f(job);
insert into public.job_segments (id, job_id, position, start_time, end_time)
values (pg_temp.rid('segment_1'), pg_temp.rid('block'), 1, '10:00', '10:30'),
       (pg_temp.rid('segment_2'), pg_temp.rid('block'), 2, '10:30', '11:00');
insert into public.job_application_segments (application_id, segment_id)
values (pg_temp.rid('block_instructor_a'), pg_temp.rid('segment_1')),
       (pg_temp.rid('block_instructor_b'), pg_temp.rid('segment_2'));
insert into public.job_segment_confirmations (job_id, segment_id, application_id,
                                              instructor_id, organization_agreed_by,
                                              confirmed_at)
values (pg_temp.rid('block'), pg_temp.rid('segment_1'), pg_temp.rid('block_instructor_a'),
        pg_temp.rid('instructor_a'), pg_temp.rid('owner'), now()),
       (pg_temp.rid('block'), pg_temp.rid('segment_2'), pg_temp.rid('block_instructor_b'),
        pg_temp.rid('instructor_b'), pg_temp.rid('owner'), now());

-- Reviews written before this feature: inserted without the new column.
insert into public.reviews (job_id, reviewer_id, reviewee_id, side, rating, comment, released_at)
values (pg_temp.rid('legacy'), pg_temp.rid('owner'), pg_temp.rid('instructor_a'),
        'organization', 3, 'Legacy review', now()),
       (pg_temp.rid('legacy'), pg_temp.rid('instructor_a'), pg_temp.rid('owner'),
        'instructor', 4, 'Legacy review', now());

-- ---------------------------------------------------------------------------
-- API surface: exactly one submit_review, no anon access, no direct inserts.
-- ---------------------------------------------------------------------------
do $$ begin
  perform pg_temp.check(
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'submit_review') = 1,
    'submit_review must not have overloads');
  perform pg_temp.check(
    to_regprocedure('public.submit_review(uuid,integer,text,uuid)') is null,
    'old submit_review signature without attributes still exists');
  perform pg_temp.check(
    (select prosecdef and proconfig @> array['search_path=""']
     from pg_proc where oid = 'public.submit_review(uuid,integer,text,uuid,text[])'::regprocedure),
    'submit_review must stay SECURITY DEFINER with an empty search_path');
  perform pg_temp.check(
    not has_function_privilege('anon', 'public.submit_review(uuid,integer,text,uuid,text[])', 'EXECUTE')
    and not has_function_privilege('public', 'public.submit_review(uuid,integer,text,uuid,text[])', 'EXECUTE'),
    'submit_review is executable without authentication');
  perform pg_temp.check(
    has_function_privilege('authenticated', 'public.submit_review(uuid,integer,text,uuid,text[])', 'EXECUTE'),
    'submit_review is not executable for authenticated users');
  perform pg_temp.check(
    not has_table_privilege('authenticated', 'public.reviews', 'INSERT')
    and not has_table_privilege('anon', 'public.reviews', 'INSERT'),
    'reviews must only be written through submit_review');
  perform pg_temp.check(
    (select attributes from public.reviews
     where job_id = pg_temp.rid('legacy') and side = 'organization') = '{}'::text[],
    'existing reviews must default to an empty attribute list');
end $$;

-- ---------------------------------------------------------------------------
-- Database constraint applies to every write route, including service role.
-- ---------------------------------------------------------------------------
select pg_temp.expect_error(format(
  $$insert into public.reviews (job_id, reviewer_id, reviewee_id, side, rating, attributes)
    values (%L, %L, %L, 'organization', 4, array['professional','flexible','quality_lessons','keeps_agreements'])$$,
  pg_temp.rid('upcoming'), pg_temp.rid('outsider_org'), pg_temp.rid('instructor_a')),
  'reviews_attributes_valid');
select pg_temp.expect_error(format(
  $$insert into public.reviews (job_id, reviewer_id, reviewee_id, side, rating, attributes)
    values (%L, %L, %L, 'organization', 4, array['professional','professional'])$$,
  pg_temp.rid('upcoming'), pg_temp.rid('outsider_org'), pg_temp.rid('instructor_a')),
  'reviews_attributes_valid');
select pg_temp.expect_error(format(
  $$insert into public.reviews (job_id, reviewer_id, reviewee_id, side, rating, attributes)
    values (%L, %L, %L, 'organization', 4, array['professional','flexible','professional'])$$,
  pg_temp.rid('upcoming'), pg_temp.rid('outsider_org'), pg_temp.rid('instructor_a')),
  'reviews_attributes_valid');
select pg_temp.expect_error(format(
  $$insert into public.reviews (job_id, reviewer_id, reviewee_id, side, rating, attributes)
    values (%L, %L, %L, 'organization', 4, array['good_facilities'])$$,
  pg_temp.rid('upcoming'), pg_temp.rid('outsider_org'), pg_temp.rid('instructor_a')),
  'reviews_attributes_valid');
select pg_temp.expect_error(format(
  $$insert into public.reviews (job_id, reviewer_id, reviewee_id, side, rating, attributes)
    values (%L, %L, %L, 'instructor', 4, array['professional'])$$,
  pg_temp.rid('upcoming'), pg_temp.rid('instructor_a'), pg_temp.rid('owner')),
  'reviews_attributes_valid');
select pg_temp.expect_error(format(
  $$insert into public.reviews (job_id, reviewer_id, reviewee_id, side, rating, attributes)
    values (%L, %L, %L, 'instructor', 4, array['Goede faciliteiten'])$$,
  pg_temp.rid('upcoming'), pg_temp.rid('instructor_a'), pg_temp.rid('owner')),
  'reviews_attributes_valid');
select pg_temp.expect_error(format(
  $$insert into public.reviews (job_id, reviewer_id, reviewee_id, side, rating, attributes)
    values (%L, %L, %L, 'instructor', 4, array[null]::text[])$$,
  pg_temp.rid('upcoming'), pg_temp.rid('instructor_a'), pg_temp.rid('owner')),
  'reviews_attributes_valid');
select pg_temp.expect_error(format(
  $$insert into public.reviews (job_id, reviewer_id, reviewee_id, side, rating, attributes)
    values (%L, %L, %L, 'instructor', 4, '{{good_facilities}}'::text[])$$,
  pg_temp.rid('upcoming'), pg_temp.rid('instructor_a'), pg_temp.rid('owner')),
  'reviews_attributes_valid');
select pg_temp.expect_error(format(
  $$insert into public.reviews (job_id, reviewer_id, reviewee_id, side, rating, attributes)
    values (%L, %L, %L, 'instructor', 4, '[2:3]={good_facilities,well_organized}'::text[])$$,
  pg_temp.rid('upcoming'), pg_temp.rid('instructor_a'), pg_temp.rid('owner')),
  'reviews_attributes_valid');

-- ---------------------------------------------------------------------------
-- Instructor rates the gym (whole job): zero attributes stays valid.
-- ---------------------------------------------------------------------------
set role authenticated;

-- Unauthorized: not a participant, not completed, no session.
select pg_temp.act_as('outsider');
select pg_temp.expect_error(format(
  $$select public.submit_review(%L, 5, '', null, array['good_facilities'])$$, pg_temp.rid('whole')),
  'Alleen betrokkenen kunnen beoordelen.');
select pg_temp.act_as('outsider_org');
select pg_temp.expect_error(format(
  $$select public.submit_review(%L, 5, '', null, array['professional'])$$, pg_temp.rid('whole')),
  'Alleen betrokkenen kunnen beoordelen.');
select pg_temp.act_as('instructor_a');
select pg_temp.expect_error(format(
  $$select public.submit_review(%L, 5, '', null, array['good_facilities'])$$, pg_temp.rid('upcoming')),
  'Alleen afgeronde opdrachten kunnen worden beoordeeld.');
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.expect_error(format(
  $$select public.submit_review(%L, 5, '', null, array['good_facilities'])$$, pg_temp.rid('whole')),
  'Alleen betrokkenen kunnen beoordelen.');

-- Invalid input from a legitimate instructor.
select pg_temp.act_as('instructor_a');
select pg_temp.expect_error(format(
  $$select public.submit_review(%L, 4, '', null,
    array['clear_communication','well_organized','agreements_kept','good_facilities'])$$,
  pg_temp.rid('whole')), 'Kies maximaal drie kenmerken.');
select pg_temp.expect_error(format(
  $$select public.submit_review(%L, 4, '', null, array['well_organized','well_organized'])$$,
  pg_temp.rid('whole')), 'Kies ieder kenmerk maar één keer.');
select pg_temp.expect_error(format(
  $$select public.submit_review(%L, 4, '', null, array['professional'])$$,
  pg_temp.rid('whole')), 'Een gekozen kenmerk hoort niet bij deze beoordeling.');
select pg_temp.expect_error(format(
  $$select public.submit_review(%L, 4, '', null, array['Duidelijke communicatie'])$$,
  pg_temp.rid('whole')), 'Een gekozen kenmerk hoort niet bij deze beoordeling.');
select pg_temp.expect_error(format(
  $$select public.submit_review(%L, 4, '', null, array['WELL_ORGANIZED'])$$,
  pg_temp.rid('whole')), 'Een gekozen kenmerk hoort niet bij deze beoordeling.');
select pg_temp.expect_error(format(
  $$select public.submit_review(%L, 4, '', null, array[null]::text[])$$,
  pg_temp.rid('whole')), 'De gekozen kenmerken zijn ongeldig.');
select pg_temp.expect_error(format(
  $$select public.submit_review(%L, 4, '', null, '{{well_organized}}'::text[])$$,
  pg_temp.rid('whole')), 'De gekozen kenmerken zijn ongeldig.');
-- Stars stay mandatory, also with attributes.
select pg_temp.expect_error(format(
  $$select public.submit_review(%L, 0, '', null, array['well_organized'])$$,
  pg_temp.rid('whole')), 'Een beoordeling is 1 tot en met 5 sterren.');
do $$ begin
  perform pg_temp.check(
    not exists (select 1 from public.reviews where job_id = pg_temp.rid('whole')),
    'a refused review was stored');
end $$;

-- The existing four-argument call shape (no attributes) still works.
select public.submit_review(pg_temp.rid('whole'), 4, 'Duidelijke briefing', null);
do $$ begin
  perform pg_temp.check(
    (select attributes = '{}'::text[] and released_at is null and comment = 'Duidelijke briefing'
     from public.reviews where job_id = pg_temp.rid('whole') and reviewer_id = auth.uid()),
    'zero-attribute review not stored as an unreleased, empty list');
end $$;
select pg_temp.expect_error(format(
  $$select public.submit_review(%L, 5, '', null, array['good_facilities'])$$, pg_temp.rid('whole')),
  'reviews_job_reviewer_reviewee_unique');

-- Double blind: the gym cannot see the instructor's review or its attributes.
select pg_temp.act_as('owner');
do $$ begin
  perform pg_temp.check(
    not exists (select 1 from public.reviews
                where job_id = pg_temp.rid('whole') and reviewer_id = pg_temp.rid('instructor_a')),
    'unreleased instructor review visible to the gym');
end $$;

-- ---------------------------------------------------------------------------
-- Gym rates the instructor (whole job): role-foreign codes refused, three
-- attributes stored in the fixed order, then both reviews are released.
-- ---------------------------------------------------------------------------
select pg_temp.expect_error(format(
  $$select public.submit_review(%L, 5, '', null, array['good_facilities'])$$,
  pg_temp.rid('whole')), 'Een gekozen kenmerk hoort niet bij deze beoordeling.');
select pg_temp.expect_error(format(
  $$select public.submit_review(%L, 5, '', null, array['professional','flexible','professional'])$$,
  pg_temp.rid('whole')), 'Kies ieder kenmerk maar één keer.');
select public.submit_review(
  pg_temp.rid('whole'), 5, 'Top', null,
  array['flexible', 'keeps_agreements', 'professional']);
do $$ begin
  perform pg_temp.check(
    (select attributes from public.reviews
     where job_id = pg_temp.rid('whole') and reviewer_id = auth.uid())
      = array['keeps_agreements', 'professional', 'flexible'],
    'gym attributes not stored in canonical order');
  perform pg_temp.check(
    (select count(*) from public.reviews
     where job_id = pg_temp.rid('whole') and released_at is not null) = 2,
    'whole-job reviews not released after both sides reviewed');
  perform pg_temp.check(
    (select attributes from public.reviews
     where job_id = pg_temp.rid('whole') and reviewer_id = pg_temp.rid('instructor_a')) = '{}'::text[],
    'released zero-attribute review changed');
end $$;

-- Released attributes are visible to other users in scope, never cross-demo.
select pg_temp.act_as('outsider');
do $$ begin
  perform pg_temp.check(
    (select attributes from public.reviews
     where job_id = pg_temp.rid('whole') and reviewer_id = pg_temp.rid('owner'))
      = array['keeps_agreements', 'professional', 'flexible'],
    'released attributes not visible with the review');
end $$;
select pg_temp.act_as('demo_user');
do $$ begin
  perform pg_temp.check(
    not exists (select 1 from public.reviews where job_id = pg_temp.rid('whole')),
    'demo user can read reviews outside the demo');
end $$;

-- Only admins may update reviews; the constraint still applies to them.
select pg_temp.act_as('instructor_a');
update public.reviews set attributes = array['good_facilities']
where job_id = pg_temp.rid('whole') and reviewer_id = auth.uid();
do $$ begin
  perform pg_temp.check(
    (select attributes from public.reviews
     where job_id = pg_temp.rid('whole') and reviewer_id = auth.uid()) = '{}'::text[],
    'non-admin changed review attributes after submitting');
end $$;
select pg_temp.act_as('admin');
select pg_temp.expect_error(format(
  $$update public.reviews set attributes = array['professional'] where job_id = %L and reviewer_id = %L$$,
  pg_temp.rid('whole'), pg_temp.rid('instructor_a')), 'reviews_attributes_valid');

-- ---------------------------------------------------------------------------
-- Lesson block with two instructors: release stays per instructor.
-- ---------------------------------------------------------------------------
select pg_temp.act_as('instructor_a');
select public.submit_review(pg_temp.rid('block'), 4, '', null, array['pleasant_collaboration']);

select pg_temp.act_as('owner');
select pg_temp.expect_error(format(
  $$select public.submit_review(%L, 4, '', null, array['professional'])$$, pg_temp.rid('block')),
  'Kies welke instructeur je beoordeelt.');
select pg_temp.expect_error(format(
  $$select public.submit_review(%L, 4, '', %L, array['professional','flexible','quality_lessons','communicates_clearly'])$$,
  pg_temp.rid('block'), pg_temp.rid('instructor_b')), 'Kies maximaal drie kenmerken.');
select public.submit_review(pg_temp.rid('block'), 5, '', pg_temp.rid('instructor_a'),
                            array['quality_lessons', 'communicates_clearly']);
select pg_temp.expect_error(format(
  $$select public.submit_review(%L, 2, '', %L, array['flexible'])$$,
  pg_temp.rid('block'), pg_temp.rid('instructor_a')), 'reviews_job_reviewer_reviewee_unique');
select public.submit_review(pg_temp.rid('block'), 3, '', pg_temp.rid('instructor_b'),
                            array['flexible']);

reset role;
do $$ begin
  perform pg_temp.check(
    (select count(*) from public.reviews
     where job_id = pg_temp.rid('block')
       and (reviewer_id = pg_temp.rid('instructor_a') or reviewee_id = pg_temp.rid('instructor_a'))
       and released_at is not null) = 2,
    'instructor_a pair not released');
  perform pg_temp.check(
    (select attributes from public.reviews
     where job_id = pg_temp.rid('block') and reviewee_id = pg_temp.rid('instructor_a'))
      = array['communicates_clearly', 'quality_lessons'],
    'block review attributes for instructor_a not stored in canonical order');
  perform pg_temp.check(
    (select released_at is null from public.reviews
     where job_id = pg_temp.rid('block') and reviewee_id = pg_temp.rid('instructor_b')),
    'gym review of instructor_b released before instructor_b reviewed');
end $$;

-- Neither instructor_b nor the co-instructor can see the unreleased review
-- (and therefore its attributes) about instructor_b.
set role authenticated;
select pg_temp.act_as('instructor_b');
do $$ begin
  perform pg_temp.check(
    not exists (select 1 from public.reviews
                where job_id = pg_temp.rid('block') and reviewee_id = pg_temp.rid('instructor_b')),
    'unreleased gym review visible to its reviewee');
end $$;
select pg_temp.act_as('instructor_a');
do $$ begin
  perform pg_temp.check(
    not exists (select 1 from public.reviews
                where job_id = pg_temp.rid('block') and reviewee_id = pg_temp.rid('instructor_b')),
    'unreleased gym review visible to a co-instructor');
  perform pg_temp.check(
    (select attributes from public.reviews
     where job_id = pg_temp.rid('block') and reviewee_id = pg_temp.rid('instructor_a'))
      = array['communicates_clearly', 'quality_lessons'],
    'released block review not visible to its reviewee');
end $$;

-- instructor_b: role-foreign codes are refused for the instructor side too.
select pg_temp.act_as('instructor_b');
select pg_temp.expect_error(format(
  $$select public.submit_review(%L, 5, '', null, array['professional'])$$, pg_temp.rid('block')),
  'Een gekozen kenmerk hoort niet bij deze beoordeling.');
select public.submit_review(pg_temp.rid('block'), 5, '', null,
                            array['good_facilities', 'clear_communication', 'well_organized']);
do $$ begin
  perform pg_temp.check(
    (select attributes from public.reviews
     where job_id = pg_temp.rid('block') and reviewee_id = pg_temp.rid('instructor_b'))
      = array['flexible'],
    'gym review of instructor_b not released with its attributes');
  perform pg_temp.check(
    (select attributes from public.reviews
     where job_id = pg_temp.rid('block') and reviewer_id = auth.uid())
      = array['clear_communication', 'well_organized', 'good_facilities'],
    'instructor_b attributes not stored in canonical order');
end $$;

-- ---------------------------------------------------------------------------
-- Statistics ignore attributes: unchanged rating average and count.
-- ---------------------------------------------------------------------------
do $$ begin
  perform pg_temp.check(
    (select avg_rating = 4.33 and review_count = 3
     from public.instructor_public_stats(pg_temp.rid('instructor_a'))),
    'instructor statistics changed by attributes');
end $$;

reset role;
rollback;
select 'REVIEW ATTRIBUTE TESTS GESLAAGD' as resultaat;
