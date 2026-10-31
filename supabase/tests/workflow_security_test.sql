-- Isolated fixtures; never execute test files against production.
\set ON_ERROR_STOP on
begin;
create function pg_temp.fixture(label text) returns uuid language sql immutable
as $$ select md5('workflow-audit-2026-10-16-' || label)::uuid $$;
grant execute on function pg_temp.fixture(text) to authenticated;
insert into auth.users (id,email,raw_user_meta_data)
select pg_temp.fixture(label), label || '@workflow.test', jsonb_build_object('role',role,'full_name',label)
from (values ('instructor','instructor'),('replacement','instructor'),
             ('owner','organization'),('outsider','organization')) f(label,role);
select set_config('request.jwt.claim.sub',pg_temp.fixture('owner')::text,false);
insert into public.instructor_profiles(user_id)
values (pg_temp.fixture('instructor')),(pg_temp.fixture('replacement'));
insert into public.document_uploads(user_id,doc_type,storage_path,original_filename,status,expires_at)
select pg_temp.fixture(label),'vog','tests/workflow/'||label||'.pdf','synthetic.pdf','approved',current_date+365
from (values ('instructor'),('replacement')) f(label);
insert into public.organizations(id,name,org_type,created_by)
values(pg_temp.fixture('org'),'Workflow audit','gym',pg_temp.fixture('owner'));
insert into public.organization_members(organization_id,user_id,member_role)
values(pg_temp.fixture('org'),pg_temp.fixture('owner'),'owner');
insert into public.organization_locations(id,organization_id,name,city_id)
values(pg_temp.fixture('location'),pg_temp.fixture('org'),'Workflow audit',
       (select id from public.cities where name='Utrecht'));
insert into public.jobs(id,organization_id,location_id,created_by,job_type,sport_id,title,
                        starts_on,start_time,end_time,pay_type,pay_hourly_rate_cents,status)
select pg_temp.fixture(label),pg_temp.fixture('org'),pg_temp.fixture('location'),pg_temp.fixture('owner'),
       'one_time',(select id from public.sports where slug='fitness'),label,
       current_date+30+(row_number() over ())::integer,'10:00','11:00','hourly',4500,status::public.job_status
from (values ('whole_closed','closed'),('block_closed','closed'),('invitation_closed','closed'),
             ('counter_closed','closed'),('replacement_job','confirmed'),('block_access','open'),
             ('replacement_completed','completed')) f(label,status);
insert into public.job_applications(id,job_id,instructor_id)
select pg_temp.fixture(label||'_app'),pg_temp.fixture(label),pg_temp.fixture('instructor')
from (values ('whole_closed'),('block_closed'),('counter_closed'),
             ('replacement_job'),('block_access'),('replacement_completed')) f(label);
insert into public.job_confirmations(job_id,application_id,instructor_id,organization_agreed_at,confirmed_at)
select pg_temp.fixture(label),pg_temp.fixture(label||'_app'),pg_temp.fixture('instructor'),now(),
       case when label='whole_closed' then null else now() end
from (values ('whole_closed'),('replacement_job'),('replacement_completed')) f(label);
-- Completed-job fixture must not accidentally trip the unrelated review gate.
insert into public.reviews(job_id,reviewer_id,reviewee_id,side,rating)
values (pg_temp.fixture('replacement_completed'),pg_temp.fixture('instructor'),pg_temp.fixture('owner'),'instructor',5),
       (pg_temp.fixture('replacement_completed'),pg_temp.fixture('owner'),pg_temp.fixture('instructor'),'organization',5);
insert into public.job_segments(id,job_id,position,start_time,end_time)
select pg_temp.fixture(label||'_segment'),pg_temp.fixture(label),1,'10:00','11:00'
from (values ('block_closed'),('block_access')) f(label);
insert into public.job_application_segments(application_id,segment_id)
select pg_temp.fixture(label||'_app'),pg_temp.fixture(label||'_segment')
from (values ('block_closed'),('block_access')) f(label);
insert into public.job_segment_confirmations(job_id,segment_id,application_id,instructor_id,organization_agreed_by)
select pg_temp.fixture(label),pg_temp.fixture(label||'_segment'),pg_temp.fixture(label||'_app'),
       pg_temp.fixture('instructor'),pg_temp.fixture('owner')
from (values ('block_closed'),('block_access')) f(label);
insert into public.job_invitations(id,job_id,instructor_id,invited_by)
values(pg_temp.fixture('invite'),pg_temp.fixture('invitation_closed'),pg_temp.fixture('instructor'),pg_temp.fixture('owner'));
insert into public.job_counteroffers(id,application_id,created_by,side,pay_type,amount_cents)
values(pg_temp.fixture('offer'),pg_temp.fixture('counter_closed_app'),pg_temp.fixture('owner'),'organization','hourly',5000);
insert into public.replacements(id,job_id,original_instructor_id,proposed_instructor_id)
select pg_temp.fixture(label||'_proposal'),pg_temp.fixture(label),pg_temp.fixture('instructor'),pg_temp.fixture('replacement')
from (values ('replacement_job'),('replacement_completed')) f(label);
create function pg_temp.expect_refused(statement text, expected_message text) returns void
language plpgsql security invoker set search_path='' as $$
begin
  execute statement;
  raise exception 'FAIL: protected workflow accepted action';
exception when others then
  if sqlerrm <> expected_message then
    raise exception 'FAIL: expected %, got %',expected_message,sqlerrm;
  end if;
end $$;
grant execute on function pg_temp.expect_refused(text,text) to authenticated;

-- Existing least-privilege and pool semantics must survive CREATE OR REPLACE.
do $$ begin
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.prosecdef and has_function_privilege('authenticated',p.oid,'EXECUTE')) <> 35 then
    raise exception 'FAIL: unexpected public SECURITY DEFINER API surface';
  end if;
  if not (select prosecdef from pg_proc where oid='public.accept_organization_invitation(uuid)'::regprocedure) then
    raise exception 'FAIL: reviewed invitation acceptance API is missing';
  end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.prosecdef and
      (has_function_privilege('anon',p.oid,'EXECUTE') or not coalesce(p.proconfig @> array['search_path=""'],false))) then
    raise exception 'FAIL: anonymous execute or unsafe search_path';
  end if;
  if exists(select 1 from pg_proc where oid in ('public.set_instructor_connection(uuid,uuid,boolean)'::regprocedure,
        'public.invite_connected_instructors(uuid,text)'::regprocedure) and prosecdef) then
    raise exception 'FAIL: pool RPC stopped being SECURITY INVOKER';
  end if;
  if has_table_privilege('authenticated','public.demo_sessions','SELECT')
    or has_table_privilege('anon','public.demo_sessions','SELECT') then
    raise exception 'FAIL: demo session table exposed';
  end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.fixture('instructor')::text,false);
select pg_temp.expect_refused(format('select public.confirm_job(%L)',pg_temp.fixture('whole_closed')),
  'Deze opdracht staat niet meer open voor bevestiging.');
select pg_temp.expect_refused(format('select public.confirm_job_segments(%L)',pg_temp.fixture('block_closed')),
  'Dit lessenblok staat niet meer open voor bevestiging.');
select pg_temp.expect_refused(format('select public.respond_invitation(%L,true)',pg_temp.fixture('invite')),
  'Deze opdracht staat niet meer open voor reacties.');
select pg_temp.expect_refused(format('select public.respond_counteroffer(%L,true)',pg_temp.fixture('offer')),
  'Deze opdracht staat niet meer open voor tegenvoorstellen.');
reset role;
update public.subscriptions set status='cancelled' where instructor_id=pg_temp.fixture('instructor');
set role authenticated;
select pg_temp.expect_refused(format('select public.confirm_job_segments(%L)',pg_temp.fixture('block_access')),
  'Je abonnement of proefperiode is niet actief.');
reset role;
update public.subscriptions set status='trial' where instructor_id=pg_temp.fixture('instructor');
update public.subscriptions set status='cancelled' where location_id=pg_temp.fixture('location');
select set_config('request.jwt.claim.sub',pg_temp.fixture('owner')::text,false);
set role authenticated;
select pg_temp.expect_refused(format('select public.select_candidate_segments(%L,array[%L::uuid])',
  pg_temp.fixture('block_access_app'),pg_temp.fixture('block_access_segment')),
  'Het abonnement voor deze vestiging is niet actief.');
reset role;
update public.subscriptions set status='trial' where location_id=pg_temp.fixture('location');
-- Proposal was valid at creation; the document expires before approval.
update public.document_uploads set expires_at=current_date-1 where user_id=pg_temp.fixture('replacement');
set role authenticated;
select pg_temp.expect_refused(format('select public.decide_replacement(%L,true)',pg_temp.fixture('replacement_job_proposal')),
  'De voorgestelde vervanger heeft geen goedgekeurde, geldige VOG.');
reset role;
update public.document_uploads set expires_at=current_date+365 where user_id=pg_temp.fixture('replacement');
set role authenticated;
select pg_temp.expect_refused(format('select public.decide_replacement(%L,true)',pg_temp.fixture('replacement_completed_proposal')),
  'Alleen bevestigde opdrachten kunnen een vervanger krijgen.');
select set_config('request.jwt.claim.sub',pg_temp.fixture('outsider')::text,false);
select pg_temp.expect_refused(format('select public.decide_replacement(%L,true)',pg_temp.fixture('replacement_job_proposal')),
  'Alleen de organisatie kan een vervanger beoordelen.');
select set_config('request.jwt.claim.sub',pg_temp.fixture('owner')::text,false);
-- Positive control: valid replacement still succeeds.
select public.decide_replacement(pg_temp.fixture('replacement_job_proposal'),true);
reset role;
do $$ begin
  if (select instructor_id from public.job_confirmations where job_id=pg_temp.fixture('replacement_job'))
       is distinct from pg_temp.fixture('replacement') then raise exception 'FAIL: valid replacement lost'; end if;
  if (select status from public.jobs where id=pg_temp.fixture('whole_closed')) <> 'closed'
    or exists(select 1 from public.job_confirmations where job_id=pg_temp.fixture('whole_closed') and confirmed_at is not null)
    or exists(select 1 from public.job_segment_confirmations where job_id in (pg_temp.fixture('block_closed'),pg_temp.fixture('block_access')) and confirmed_at is not null)
    or exists(select 1 from public.job_applications where job_id=pg_temp.fixture('invitation_closed'))
    or (select status from public.job_invitations where id=pg_temp.fixture('invite')) <> 'pending'
    or (select status from public.job_counteroffers where id=pg_temp.fixture('offer')) <> 'pending'
    or (select status from public.replacements where id=pg_temp.fixture('replacement_completed_proposal')) <> 'proposed' then
    raise exception 'FAIL: refused workflow changed data';
  end if;
end $$;
rollback;
select 'WORKFLOW SECURITY TESTS GESLAAGD' as resultaat;
