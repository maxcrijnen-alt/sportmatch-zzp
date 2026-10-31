-- Synthetic fixtures in a disposable database only.
\set ON_ERROR_STOP on
begin;
create function pg_temp.hardening_id(label text) returns uuid language sql immutable
as $$ select md5('sportmatch-functional-hardening:' || label)::uuid $$;
create function pg_temp.hardening_user(label text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', pg_temp.hardening_id(label)::text, false);
$$;
create function pg_temp.hardening_refused(statement text, expected text) returns void
language plpgsql security invoker set search_path='' as $$
begin
  execute statement;
  raise exception 'FAIL: unauthorized negotiation succeeded';
exception when others then
  if sqlerrm <> expected then raise exception 'FAIL: expected %, got %', expected, sqlerrm; end if;
end $$;

insert into auth.users(id,email,raw_user_meta_data)
select pg_temp.hardening_id(label), label || '@hardening.test', jsonb_build_object('role',role,'full_name',label)
from (values ('owner','organization'),('instructor','instructor'),('outsider','organization')) f(label,role);
insert into public.instructor_profiles(user_id) values(pg_temp.hardening_id('instructor'));
insert into public.organizations(id,name,org_type,created_by)
values(pg_temp.hardening_id('org'),'Functional hardening','gym',pg_temp.hardening_id('owner'));
insert into public.organization_members(organization_id,user_id,member_role)
values(pg_temp.hardening_id('org'),pg_temp.hardening_id('owner'),'owner');
insert into public.organization_locations(id,organization_id,name,city_id)
values(pg_temp.hardening_id('location'),pg_temp.hardening_id('org'),'Synthetic location',
  (select id from public.cities where name='Utrecht'));
insert into public.jobs(id,organization_id,location_id,created_by,job_type,sport_id,title,
                       starts_on,start_time,end_time,pay_type,pay_hourly_rate_cents,pay_is_negotiable)
select pg_temp.hardening_id(label),pg_temp.hardening_id('org'),pg_temp.hardening_id('location'),
  pg_temp.hardening_id('owner'),'one_time',(select id from public.sports where slug='fitness'),label,
  (now() at time zone 'Europe/Amsterdam')::date + 30,'10:00','11:00','hourly',4500,label <> 'fixed'
from (values ('negotiable'),('fixed'),('selected'),('segment'),('inactive'),('closed')) f(label);
insert into public.job_applications(id,job_id,instructor_id)
select pg_temp.hardening_id(label||'-app'),pg_temp.hardening_id(label),pg_temp.hardening_id('instructor')
from (values ('negotiable'),('fixed'),('selected'),('segment'),('inactive'),('closed')) f(label);
insert into public.job_confirmations(job_id,application_id,instructor_id,organization_agreed_at)
values(pg_temp.hardening_id('selected'),pg_temp.hardening_id('selected-app'),pg_temp.hardening_id('instructor'),now());
insert into public.job_segments(id,job_id,position,start_time,end_time)
values(pg_temp.hardening_id('segment-lesson'),pg_temp.hardening_id('segment'),1,'10:00','11:00');
insert into public.job_segment_confirmations(job_id,segment_id,application_id,instructor_id,organization_agreed_by)
values(pg_temp.hardening_id('segment'),pg_temp.hardening_id('segment-lesson'),pg_temp.hardening_id('segment-app'),
  pg_temp.hardening_id('instructor'),pg_temp.hardening_id('owner'));

-- Positive controls: either authorized side may propose and the other may respond.
select pg_temp.hardening_user('instructor');
set local role authenticated;
select public.create_counteroffer(pg_temp.hardening_id('negotiable-app'),'hourly',5000,'Synthetic offer');
select pg_temp.hardening_refused(
  format('select public.create_counteroffer(%L,''hourly'',5000)',pg_temp.hardening_id('fixed-app')),
  'De vergoeding van deze opdracht is niet onderhandelbaar.');
select pg_temp.hardening_refused(
  format('select public.create_counteroffer(%L,''both'',5000)',pg_temp.hardening_id('negotiable-app')),
  'Kies een uurtarief of een vast bedrag.');
select pg_temp.hardening_refused(
  format('select public.create_counteroffer(%L,''hourly'',0)',pg_temp.hardening_id('negotiable-app')),
  'Een tegenvoorstel heeft een geldig bedrag nodig.');
select pg_temp.hardening_refused(
  format('select public.create_counteroffer(%L,''hourly'',5000)',pg_temp.hardening_id('selected-app')),
  'Deze reactie is niet meer beschikbaar voor tegenvoorstellen.');
select pg_temp.hardening_refused(
  format('select public.create_counteroffer(%L,''hourly'',5000)',pg_temp.hardening_id('segment-app')),
  'Deze reactie is niet meer beschikbaar voor tegenvoorstellen.');
reset role;
select pg_temp.hardening_user('owner');
set local role authenticated;
select public.respond_counteroffer((select id from public.job_counteroffers where application_id=pg_temp.hardening_id('negotiable-app')),true);
select public.create_counteroffer(pg_temp.hardening_id('negotiable-app'),'fixed',6000,'Synthetic counter');
reset role;
select pg_temp.hardening_user('instructor');
set local role authenticated;
select public.respond_counteroffer((select id from public.job_counteroffers where application_id=pg_temp.hardening_id('negotiable-app') and side='organization'),false);
reset role;

-- Direct requests cannot negotiate a rejected, accepted or withdrawn response.
do $$ declare state public.application_status; begin
  foreach state in array array['rejected','accepted','withdrawn']::public.application_status[] loop
    update public.job_applications set status=state where id=pg_temp.hardening_id('inactive-app');
    perform pg_temp.hardening_refused(
      format('select public.create_counteroffer(%L,''hourly'',5000)',pg_temp.hardening_id('inactive-app')),
      'Deze reactie is niet meer beschikbaar voor tegenvoorstellen.');
  end loop;
end $$;
-- Selection must also respect a withdrawn application, even with a direct RPC.
select pg_temp.hardening_user('owner');
set local role authenticated;
select pg_temp.hardening_refused(
  format('select public.select_candidate(%L)',pg_temp.hardening_id('inactive-app')),
  'Deze reactie is niet meer beschikbaar voor selectie.');
reset role;
update public.job_applications set status='withdrawn' where id=pg_temp.hardening_id('segment-app');
set local role authenticated;
select pg_temp.hardening_refused(
  format('select public.select_candidate_segments(%L,array[%L::uuid])',
    pg_temp.hardening_id('segment-app'),pg_temp.hardening_id('segment-lesson')),
  'Deze reactie is niet meer beschikbaar voor selectie.');
reset role;
update public.job_applications set status='pending' where id=pg_temp.hardening_id('segment-app');
-- Existing proposals become unusable if the job, application or selection changes.
insert into public.job_counteroffers(id,application_id,created_by,side,pay_type,amount_cents)
select pg_temp.hardening_id(label||'-offer'),pg_temp.hardening_id(label||'-app'),pg_temp.hardening_id('owner'),'organization','hourly',5000
from (values ('fixed'),('selected'),('segment'),('inactive'),('closed')) f(label);
update public.jobs set status='closed' where id=pg_temp.hardening_id('closed');
select pg_temp.hardening_user('instructor');
set local role authenticated;
select pg_temp.hardening_refused(
  format('select public.respond_counteroffer(%L,true)',pg_temp.hardening_id('fixed-offer')),
  'De vergoeding van deze opdracht is niet onderhandelbaar.');
select pg_temp.hardening_refused(
  format('select public.respond_counteroffer(%L,true)',pg_temp.hardening_id('selected-offer')),
  'Deze reactie is niet meer beschikbaar voor tegenvoorstellen.');
select pg_temp.hardening_refused(
  format('select public.respond_counteroffer(%L,true)',pg_temp.hardening_id('segment-offer')),
  'Deze reactie is niet meer beschikbaar voor tegenvoorstellen.');
select pg_temp.hardening_refused(
  format('select public.respond_counteroffer(%L,true)',pg_temp.hardening_id('inactive-offer')),
  'Deze reactie is niet meer beschikbaar voor tegenvoorstellen.');
select pg_temp.hardening_refused(
  format('select public.respond_counteroffer(%L,true)',pg_temp.hardening_id('closed-offer')),
  'Deze opdracht staat niet meer open voor tegenvoorstellen.');
reset role;
select pg_temp.hardening_user('outsider');
set local role authenticated;
select pg_temp.hardening_refused(
  format('select public.create_counteroffer(%L,''hourly'',5000)',pg_temp.hardening_id('negotiable-app')),
  'Geen toegang tot deze reactie.');
select pg_temp.hardening_refused(
  format('select public.respond_counteroffer(%L,true)',pg_temp.hardening_id('fixed-offer')),
  'Geen toegang.');
reset role;
do $$ begin
  if (select count(*) from public.job_counteroffers where application_id=pg_temp.hardening_id('negotiable-app')) <> 2
    or exists(select 1 from public.job_counteroffers where application_id<>pg_temp.hardening_id('negotiable-app') and status<>'pending') then
    raise exception 'FAIL: rejected calls changed proposals';
  end if;
  if has_table_privilege('authenticated','public.job_counteroffers','INSERT')
    or has_table_privilege('authenticated','public.job_counteroffers','UPDATE')
    or has_function_privilege('anon','public.create_counteroffer(uuid,public.pay_type,integer,text)','EXECUTE') then
    raise exception 'FAIL: negotiation can bypass the RPC boundary';
  end if;
end $$;

-- Document expiry must not change when the database session's zone changes.
insert into public.document_uploads(user_id,doc_type,storage_path,original_filename,status,expires_at)
values(pg_temp.hardening_id('instructor'),'vog','tests/functional/vog.pdf','synthetic.pdf','approved',
  (now() at time zone 'Europe/Amsterdam')::date);
select pg_temp.hardening_user('instructor');
do $$ declare zone text; begin
  foreach zone in array array['UTC','Pacific/Kiritimati','Etc/GMT+12','Europe/Amsterdam'] loop
    perform set_config('TimeZone',zone,true);
    if not public.has_valid_vog(pg_temp.hardening_id('instructor')) then
      raise exception 'FAIL: valid Dutch VOG rejected in %',zone;
    end if;
    update public.document_uploads set expires_at=(now() at time zone 'Europe/Amsterdam')::date-1
      where user_id=pg_temp.hardening_id('instructor');
    if public.has_valid_vog(pg_temp.hardening_id('instructor')) then
      raise exception 'FAIL: expired Dutch VOG accepted in %',zone;
    end if;
    update public.document_uploads set expires_at=(now() at time zone 'Europe/Amsterdam')::date
      where user_id=pg_temp.hardening_id('instructor');
  end loop;
end $$;
-- Withdrawing an actual pending selection releases both kinds of assignment.
select pg_temp.hardening_user('instructor');
set local role authenticated;
select public.withdraw_application(pg_temp.hardening_id('selected-app'));
select public.withdraw_application(pg_temp.hardening_id('segment-app'));
select pg_temp.hardening_refused(
  format('select public.confirm_job(%L)',pg_temp.hardening_id('selected')),
  'Er staat geen bevestiging voor jou klaar bij deze opdracht.');
select pg_temp.hardening_refused(
  format('select public.confirm_job_segments(%L)',pg_temp.hardening_id('segment')),
  'Er staan geen lesonderdelen voor jou klaar.');
reset role;
do $$ begin
  if exists(select 1 from public.job_confirmations where application_id=pg_temp.hardening_id('selected-app'))
    or exists(select 1 from public.job_segment_confirmations where application_id=pg_temp.hardening_id('segment-app'))
    or (select count(*) from public.job_applications where id in (pg_temp.hardening_id('selected-app'),pg_temp.hardening_id('segment-app')) and status='withdrawn') <> 2
    or exists(select 1 from public.jobs where id in (pg_temp.hardening_id('selected'),pg_temp.hardening_id('segment')) and status<>'open') then
    raise exception 'FAIL: withdrawal did not release pending selections';
  end if;
end $$;
-- Confirmed commitments must use the cancellation workflow, never withdrawal.
insert into public.job_confirmations(job_id,application_id,instructor_id,organization_agreed_at,confirmed_at)
values(pg_temp.hardening_id('negotiable'),pg_temp.hardening_id('negotiable-app'),pg_temp.hardening_id('instructor'),now(),now());
set local role authenticated;
select pg_temp.hardening_refused(
  format('select public.withdraw_application(%L)',pg_temp.hardening_id('negotiable-app')),
  'Een bevestigde opdracht moet via annuleren worden afgemeld.');
reset role;

rollback;
select 'FUNCTIONAL HARDENING TESTS GESLAAGD' as result;
