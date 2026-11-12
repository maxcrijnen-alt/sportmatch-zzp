-- Disposable fixtures only; no remote databases or real rosters.
\set ON_ERROR_STOP on
begin;
create function pg_temp.agenda_id(label text) returns uuid language sql immutable
as $$ select md5('sportmatch-agenda:'||label)::uuid $$;
create function pg_temp.agenda_user(label text) returns void language sql as $$
  select set_config('request.jwt.claim.sub',pg_temp.agenda_id(label)::text,false);
$$;
create function pg_temp.agenda_check(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
create function pg_temp.agenda_refused(statement text,code text) returns void
language plpgsql security invoker set search_path='' as $$
begin
  execute statement;
  raise exception 'FAIL: unauthorized agenda mutation succeeded';
exception when others then
  if sqlstate<>code then raise exception 'FAIL: expected SQLSTATE %, got %: %',code,sqlstate,sqlerrm; end if;
end $$;
create function pg_temp.agenda_batch(label text,revision integer default 0) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('externalId',label,'revision',revision,'title','Circuittraining',
    'sportId',(select id from public.sports where slug='fitness'),'lessonType','Circuittraining',
    'date',((now() at time zone 'Europe/Amsterdam')::date+30)::text,'startTime','09:00','endTime','10:00',
    'instructor','Trainer A','needsSubstitute',false,'cancelled',false));
$$;
create function pg_temp.agenda_terms() returns jsonb language sql as $$
  select jsonb_build_object('title','Circuittraining inval','description','Inval voor circuittraining.',
    'contactName','Synthetic planner','payType','hourly','payHourlyRateCents',4500,'qualificationIds','[]'::jsonb);
$$;

insert into auth.users(id,email,raw_user_meta_data)
select pg_temp.agenda_id(label),label||'@agenda.test',jsonb_build_object('role',role,'full_name',label)
from (values ('owner','organization'),('planner','organization'),('outsider','organization'),
  ('inactive','organization'),('instructor','instructor'),('demo-a','organization'),('demo-b','organization')) f(label,role);
insert into public.demo_sessions(id) values(pg_temp.agenda_id('session-a')),(pg_temp.agenda_id('session-b'));
update public.profiles set demo_session_id=pg_temp.agenda_id('session-a') where id=pg_temp.agenda_id('demo-a');
update public.profiles set demo_session_id=pg_temp.agenda_id('session-b') where id=pg_temp.agenda_id('demo-b');
insert into public.organizations(id,name,org_type,created_by,demo_session_id)
select pg_temp.agenda_id(label),'Synthetic '||label,'gym',pg_temp.agenda_id(owner),
  case when label='org-demo' then pg_temp.agenda_id('session-a') end
from (values ('org','owner'),('org-other','outsider'),('org-demo','demo-a')) f(label,owner);
insert into public.organization_members(organization_id,user_id,member_role,state)
select pg_temp.agenda_id(org),pg_temp.agenda_id(label),role::public.org_member_role,state::public.member_state
from (values ('org','owner','owner','active'),('org','planner','planner','active'),('org','inactive','planner','invited'),
  ('org-other','outsider','owner','active'),('org-demo','demo-a','owner','active'),
  -- Even a corrupted cross-demo membership must not authorize a roster.
  ('org-demo','demo-b','planner','active'),('org','demo-b','planner','active')) f(org,label,role,state);
insert into public.organization_locations(id,organization_id,name,city_id)
select pg_temp.agenda_id(label),pg_temp.agenda_id(org),label,(select id from public.cities where name='Utrecht')
from (values ('location','org'),('location-2','org'),('foreign-location','org-other'),('demo-location','org-demo')) f(label,org);

-- No extra public definer surface; neither anonymous nor direct table writes.
do $$ declare f regprocedure; begin
  foreach f in array array['public.save_agenda_lessons(uuid,text,date,integer,boolean,jsonb)'::regprocedure,
    'public.create_lesson_replacement(uuid,integer,jsonb)'::regprocedure] loop
    perform pg_temp.agenda_check(not (select prosecdef from pg_proc where oid=f),'public wrapper must use invoker');
    perform pg_temp.agenda_check(not has_function_privilege('anon',f,'EXECUTE'),'anonymous RPC access');
    perform pg_temp.agenda_check(has_function_privilege('authenticated',f,'EXECUTE'),'authenticated wrapper missing');
  end loop;
  perform pg_temp.agenda_check(not has_table_privilege('authenticated','public.scheduled_lessons','INSERT'),'direct lesson insert');
  perform pg_temp.agenda_check(not has_table_privilege('authenticated','public.lesson_replacement_jobs','UPDATE'),'direct replacement relinking');
  perform pg_temp.agenda_check(not has_table_privilege('anon','public.agenda_sources','SELECT'),'anonymous source read');
end $$;

select pg_temp.agenda_user('planner');
set local role authenticated;
select pg_temp.agenda_check((public.save_agenda_lessons(pg_temp.agenda_id('location'),'manual',current_date,null,true,pg_temp.agenda_batch('manual'))->>'ok')::boolean,'planner can create native lesson');
select pg_temp.agenda_check((select count(*)=1 from public.scheduled_lessons),'own lessons readable');
select set_config('agenda.manual_id',(select id::text from public.scheduled_lessons where external_id='manual'),true);
select pg_temp.agenda_refused(format('select public.save_agenda_lessons(%L,''manual'',current_date,null,true,%L)',pg_temp.agenda_id('foreign-location'),pg_temp.agenda_batch('foreign')),'42501');
select pg_temp.agenda_refused(format('select public.save_agenda_lessons(%L,''synthetic'',current_date,0,true,%L)',pg_temp.agenda_id('location'),pg_temp.agenda_batch('sample')),'42501');
select pg_temp.agenda_refused(format('select public.save_agenda_lessons(%L,''gymly'',current_date,0,true,%L)',pg_temp.agenda_id('location'),pg_temp.agenda_batch('fabricated')),'P0001');
select pg_temp.agenda_refused(format('select public.save_agenda_lessons(%L,''manual'',current_date,null,true,%L)',pg_temp.agenda_id('location'),pg_temp.agenda_batch('manual')),'P0001');
select pg_temp.agenda_check((public.save_agenda_lessons(pg_temp.agenda_id('location'),'manual',current_date,null,true,
  jsonb_set(pg_temp.agenda_batch('manual',1),'{0,startTime}','"09:15"'))->>'ok')::boolean,'revision edit succeeds');
select pg_temp.agenda_check((select revision=2 from public.scheduled_lessons where external_id='manual'),'revision increments');
select pg_temp.agenda_refused(format('select public.save_agenda_lessons(%L,''manual'',current_date,null,true,%L)',pg_temp.agenda_id('location'),pg_temp.agenda_batch('manual',1)),'P0001');
select pg_temp.agenda_refused(format('select public.save_agenda_lessons(%L,''manual'',current_date,null,true,%L)',pg_temp.agenda_id('location'),jsonb_set(pg_temp.agenda_batch('pii'),'{0,email}','"member@example.test"')),'P0001');
select pg_temp.agenda_refused(format('select public.save_agenda_lessons(%L,''manual'',current_date,null,true,%L)',pg_temp.agenda_id('location'),
  jsonb_set(jsonb_set(pg_temp.agenda_batch('dst'),'{0,date}','"2027-03-28"'),'{0,startTime}','"02:30"')),'P0001');
select pg_temp.agenda_refused(format('select public.save_agenda_lessons(%L,''manual'',current_date,null,true,%L)',pg_temp.agenda_id('location'),pg_temp.agenda_batch('duplicate')||pg_temp.agenda_batch('duplicate')),'P0001');
select pg_temp.agenda_check((select count(*)=1 from public.scheduled_lessons),'invalid batches rolled back');
reset role;

-- A source/lesson/link stays invisible to nonmembers, instructors, inactive and cross-demo users.
do $$ declare who text; begin
  foreach who in array array['outsider','instructor','inactive','demo-b'] loop
    perform pg_temp.agenda_user(who);
    set local role authenticated;
    perform pg_temp.agenda_check((select count(*)=0 from public.scheduled_lessons),'foreign lesson read: '||who);
    perform pg_temp.agenda_check((select count(*)=0 from public.agenda_sources),'foreign source read: '||who);
    perform pg_temp.agenda_refused(format('select public.save_agenda_lessons(%L,''manual'',current_date,null,true,%L)',pg_temp.agenda_id('location'),pg_temp.agenda_batch('attack')),'42501');
    reset role;
  end loop;
end $$;

-- Sync snapshots are atomic, stable, versioned and scoped to one location.
select pg_temp.agenda_user('owner');
set local role authenticated;
select public.save_agenda_lessons(pg_temp.agenda_id('location'),'synthetic',current_date,0,true,pg_temp.agenda_batch('synthetic'));
select pg_temp.agenda_check(public.save_agenda_lessons(pg_temp.agenda_id('location'),'synthetic',current_date,1,true,pg_temp.agenda_batch('synthetic'))->>'changed'='0','identical sync must be a no-op');
select pg_temp.agenda_check((select revision=1 from public.scheduled_lessons where external_id='synthetic'),'unchanged sync keeps lesson revision');
select pg_temp.agenda_check((select count(*)=0 from public.scheduled_lessons where location_id=pg_temp.agenda_id('location-2')),'sync isolated by location');
select pg_temp.agenda_refused(format('select public.save_agenda_lessons(%L,''synthetic'',current_date,0,true,%L)',pg_temp.agenda_id('location'),pg_temp.agenda_batch('stale')),'P0001');
select pg_temp.agenda_check(public.save_agenda_lessons(pg_temp.agenda_id('location'),'synthetic',current_date,2,true,
  jsonb_set(pg_temp.agenda_batch('synthetic'),'{0,endTime}','"08:00"'))->>'ok'='false','invalid sync fails explicitly');
select pg_temp.agenda_check((select sync_status='failed' and last_error='invalid_schedule' from public.agenda_sources where provider='synthetic'),'safe error status persisted');
select pg_temp.agenda_check((select end_time='10:00' and revision=1 from public.scheduled_lessons where external_id='synthetic'),'failed sync preserved previous roster');
select public.save_agenda_lessons(pg_temp.agenda_id('location'),'synthetic',current_date,3,true,pg_temp.agenda_batch('replacement-synthetic'));
select pg_temp.agenda_check((select cancelled from public.scheduled_lessons where external_id='synthetic'),'missing occurrence is cancelled');
select pg_temp.agenda_refused(format('select public.create_lesson_replacement(%L,1,%L)',
  (select id from public.scheduled_lessons where external_id='replacement-synthetic'),pg_temp.agenda_terms()),'P0001');
reset role;

-- Publishing must keep location access, review and revision checks inside the DB.
update public.subscriptions set status='cancelled' where location_id=pg_temp.agenda_id('location');
set local role authenticated;
select pg_temp.agenda_refused(format('select public.create_lesson_replacement(%L,2,%L)',
  current_setting('agenda.manual_id'),pg_temp.agenda_terms()),'42501');
reset role;
update public.subscriptions set status='trial',trial_ends_at=now()+interval '30 days' where location_id=pg_temp.agenda_id('location');
insert into public.instructor_profiles(user_id) values(pg_temp.agenda_id('instructor'));
insert into public.jobs(id,organization_id,location_id,created_by,job_type,sport_id,title,starts_on,start_time,end_time,status)
values(pg_temp.agenda_id('review-job'),pg_temp.agenda_id('org'),pg_temp.agenda_id('location'),pg_temp.agenda_id('owner'),
  'one_time',(select id from public.sports where slug='fitness'),'Pending review',current_date-2,'09:00','10:00','completed');
insert into public.job_applications(id,job_id,instructor_id,status)
values(pg_temp.agenda_id('review-app'),pg_temp.agenda_id('review-job'),pg_temp.agenda_id('instructor'),'accepted');
insert into public.job_confirmations(job_id,application_id,instructor_id,organization_agreed_at,confirmed_at)
values(pg_temp.agenda_id('review-job'),pg_temp.agenda_id('review-app'),pg_temp.agenda_id('instructor'),now()-interval '2 days',now()-interval '2 days');
set local role authenticated;
select pg_temp.agenda_check(public.has_pending_review(auth.uid()),'pending review positive control');
select pg_temp.agenda_refused(format('select public.create_lesson_replacement(%L,2,%L)',current_setting('agenda.manual_id'),pg_temp.agenda_terms()),'42501');
reset role;
delete from public.jobs where id=pg_temp.agenda_id('review-job');
set local role authenticated;
select pg_temp.agenda_refused(format('select public.create_lesson_replacement(%L,1,%L)',
  (select id from public.scheduled_lessons where external_id='manual'),pg_temp.agenda_terms()),'P0001');
select pg_temp.agenda_refused(format('select public.create_lesson_replacement(%L,2,%L)',
  (select id from public.scheduled_lessons where external_id='manual'),jsonb_set(pg_temp.agenda_terms(),'{payHourlyRateCents}','0')),'P0001');
select pg_temp.agenda_refused(format('select public.create_lesson_replacement(%L,2,%L)',
  current_setting('agenda.manual_id'),jsonb_set(pg_temp.agenda_terms(),'{qualificationIds}',jsonb_build_array(pg_temp.agenda_id('missing-qualification')))),'P0001');
select pg_temp.agenda_check((select count(*)=0 from public.jobs where organization_id=pg_temp.agenda_id('org')),'invalid requirements leave no orphan job');
select public.save_agenda_lessons(pg_temp.agenda_id('location'),'manual',current_date,null,true,
  jsonb_set(pg_temp.agenda_batch('cancelled'),'{0,cancelled}','true'));
select pg_temp.agenda_refused(format('select public.create_lesson_replacement(%L,1,%L)',
  (select id from public.scheduled_lessons where external_id='cancelled'),pg_temp.agenda_terms()),'P0001');
select public.save_agenda_lessons(pg_temp.agenda_id('location'),'manual',current_date,null,true,
  jsonb_set(pg_temp.agenda_batch('ended'),'{0,date}',to_jsonb(((now() at time zone 'Europe/Amsterdam')::date-1)::text)));
select pg_temp.agenda_refused(format('select public.create_lesson_replacement(%L,1,%L)',
  (select id from public.scheduled_lessons where external_id='ended'),pg_temp.agenda_terms()),'P0001');
select public.create_lesson_replacement((select id from public.scheduled_lessons where external_id='manual'),2,pg_temp.agenda_terms());
select public.create_lesson_replacement((select id from public.scheduled_lessons where external_id='manual'),2,pg_temp.agenda_terms());
select pg_temp.agenda_check((select count(*)=1 from public.lesson_replacement_jobs),'idempotent replacement link');
select pg_temp.agenda_check((select count(*)=1 from public.jobs where organization_id=pg_temp.agenda_id('org')),'idempotent job creation');
select public.save_agenda_lessons(pg_temp.agenda_id('location'),'manual',current_date,null,true,
  jsonb_set(pg_temp.agenda_batch('manual',2),'{0,startTime}','"09:30"'));
select pg_temp.agenda_check((select start_time='09:15' from public.jobs where organization_id=pg_temp.agenda_id('org')),'source edit must not rewrite agreed terms');
select pg_temp.agenda_check((select l.revision<>r.lesson_revision from public.scheduled_lessons l join public.lesson_replacement_jobs r on r.lesson_id=l.id),'source drift visible');
select public.create_lesson_replacement((select id from public.scheduled_lessons where external_id='manual'),2,pg_temp.agenda_terms());
reset role;
select pg_temp.agenda_user('outsider');
set local role authenticated;
select pg_temp.agenda_check((select count(*)=0 from public.lesson_replacement_jobs),'private links hidden');
select pg_temp.agenda_refused(format('select public.create_lesson_replacement(%L,2,%L)',
  (select id from public.scheduled_lessons where external_id='manual'),pg_temp.agenda_terms()),'42501');
reset role;

-- Even direct writes of an owned job cannot attach another organization's location.
select pg_temp.agenda_user('owner');
set local role authenticated;
select pg_temp.agenda_refused(format('update public.jobs set location_id=%L where organization_id=%L',pg_temp.agenda_id('location-2'),pg_temp.agenda_id('org')),'23514');
select pg_temp.agenda_refused(format('insert into public.jobs(organization_id,location_id,created_by,job_type,sport_id,title,starts_on,start_time,end_time) values(%L,%L,%L,''one_time'',%L,''Foreign location'',current_date,''09:00'',''10:00'')',
  pg_temp.agenda_id('org'),pg_temp.agenda_id('foreign-location'),pg_temp.agenda_id('owner'),
  (select id from public.sports where slug='fitness')),'23503');
reset role;

-- A valid demo can use its own roster; another demo with a forged membership cannot.
select pg_temp.agenda_user('demo-a');
set local role authenticated;
select public.save_agenda_lessons(pg_temp.agenda_id('demo-location'),'manual',current_date,null,true,pg_temp.agenda_batch('demo'));
reset role;
select pg_temp.agenda_user('demo-b');
set local role authenticated;
select pg_temp.agenda_check((select count(*)=0 from public.scheduled_lessons),'cross-demo lesson read');
select pg_temp.agenda_refused(format('select public.save_agenda_lessons(%L,''manual'',current_date,null,true,%L)',pg_temp.agenda_id('demo-location'),pg_temp.agenda_batch('demo-attack')),'42501');
reset role;
select 'AGENDA SECURITY TESTS GESLAAGD' as resultaat;
rollback;
