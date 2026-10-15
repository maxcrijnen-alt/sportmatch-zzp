-- Disposable fixtures only; this file is run by test:db, never on production.
\set ON_ERROR_STOP on
begin;
insert into public.demo_sessions (id) values
  ('bd000000-0000-0000-0000-000000000001'), ('bd000000-0000-0000-0000-000000000002');
insert into auth.users (id, email, raw_user_meta_data)
select id::uuid, label || '@billing.test', jsonb_build_object('role', role, 'full_name', label)
from (values
  ('b1000000-0000-0000-0000-000000000001', 'real-instructor', 'instructor'),
  ('b1000000-0000-0000-0000-000000000002', 'real-owner-a', 'organization'),
  ('b1000000-0000-0000-0000-000000000003', 'real-owner-b', 'organization'),
  ('b1000000-0000-0000-0000-000000000004', 'demo-instructor-a', 'instructor'),
  ('b1000000-0000-0000-0000-000000000005', 'demo-owner-a', 'organization'),
  ('b1000000-0000-0000-0000-000000000006', 'demo-instructor-b', 'instructor'),
  ('b1000000-0000-0000-0000-000000000007', 'demo-owner-b', 'organization'),
  ('b1000000-0000-0000-0000-000000000008', 'real-staff', 'organization')
) as fixtures(id, label, role);
update public.profiles set demo_session_id = 'bd000000-0000-0000-0000-000000000001'
where id in ('b1000000-0000-0000-0000-000000000004','b1000000-0000-0000-0000-000000000005');
update public.profiles set demo_session_id = 'bd000000-0000-0000-0000-000000000002'
where id in ('b1000000-0000-0000-0000-000000000006','b1000000-0000-0000-0000-000000000007');
insert into public.instructor_profiles (user_id)
select id from public.profiles where email in ('real-instructor@billing.test','demo-instructor-a@billing.test','demo-instructor-b@billing.test');
insert into public.organizations (id,name,org_type,created_by,demo_session_id)
select id::uuid, label, 'gym', owner_id::uuid, session_id::uuid
from (values
  ('b2000000-0000-0000-0000-000000000001','real-a','b1000000-0000-0000-0000-000000000002',null),
  ('b2000000-0000-0000-0000-000000000002','real-b','b1000000-0000-0000-0000-000000000003',null),
  ('b2000000-0000-0000-0000-000000000003','demo-a','b1000000-0000-0000-0000-000000000005','bd000000-0000-0000-0000-000000000001'),
  ('b2000000-0000-0000-0000-000000000004','demo-b','b1000000-0000-0000-0000-000000000007','bd000000-0000-0000-0000-000000000002')
) as fixtures(id,label,owner_id,session_id);
insert into public.organization_members (organization_id,user_id,member_role)
select id,created_by,'owner' from public.organizations where name in ('real-a','real-b','demo-a','demo-b');
insert into public.organization_members (organization_id,user_id,member_role)
values ('b2000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000008','planner');
insert into public.organization_locations (organization_id,name,city_id)
select id,name,(select id from public.cities where name='Utrecht')
from public.organizations where name in ('real-a','real-b','demo-a','demo-b');

create temp table billing_targets as
select s.id, coalesce(o.name,split_part(p.email,'@',1)) as label, s.trial_ends_at
from public.subscriptions s
left join public.profiles p on p.id=s.instructor_id
left join public.organization_locations l on l.id=s.location_id
left join public.organizations o on o.id=l.organization_id
where p.email like '%@billing.test' or o.name in ('real-a','real-b','demo-a','demo-b');
grant select on billing_targets to authenticated;
update public.subscriptions set status='active',current_period_end=now()+interval '1 month'
where id=(select id from billing_targets where label='real-b');

create function pg_temp.expect_billing_denied(rpc text, target uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
  execute format('select public.%I($1)',rpc) using target;
  raise exception 'FAIL: % accepted unauthorized subscription %',rpc,target;
exception when insufficient_privilege then null;
end;
$$;
grant execute on function pg_temp.expect_billing_denied(text,uuid) to authenticated;

set role authenticated;
select set_config('request.jwt.claim.sub','b1000000-0000-0000-0000-000000000001',false);
-- No production subscription, including one's own, can be mock-paid. Location
-- targets exercise the former NULL-boolean authorization bypass specifically.
select pg_temp.expect_billing_denied('mock_activate_subscription',id) from billing_targets;
select pg_temp.expect_billing_denied('cancel_subscription',id) from billing_targets where label<>'real-instructor';
do $$ begin
  if not public.instructor_has_access(auth.uid()) then raise exception 'FAIL: valid trial lost'; end if;
  begin
    update public.profiles set demo_session_id='bd000000-0000-0000-0000-000000000001' where id=auth.uid();
    raise exception 'FAIL: real user could self-assign demo scope';
  exception when insufficient_privilege then null;
  end;
end $$;
select public.cancel_subscription((select id from billing_targets where label='real-instructor'));

select set_config('request.jwt.claim.sub','b1000000-0000-0000-0000-000000000002',false);
select pg_temp.expect_billing_denied('mock_activate_subscription',id) from billing_targets;
select pg_temp.expect_billing_denied('cancel_subscription',id) from billing_targets where label<>'real-a';
select public.cancel_subscription((select id from billing_targets where label='real-a'));
select pg_temp.expect_billing_denied('mock_activate_subscription',null);
select pg_temp.expect_billing_denied('cancel_subscription',null);

select set_config('request.jwt.claim.sub','b1000000-0000-0000-0000-000000000008',false);
select pg_temp.expect_billing_denied('cancel_subscription',(select id from billing_targets where label='real-a'));

select set_config('request.jwt.claim.sub','b1000000-0000-0000-0000-000000000004',false);
select pg_temp.expect_billing_denied('mock_activate_subscription',id) from billing_targets where label<>'demo-instructor-a';
select pg_temp.expect_billing_denied('cancel_subscription',id) from billing_targets where label<>'demo-instructor-a';
select public.mock_activate_subscription((select id from billing_targets where label='demo-instructor-a'));
select public.cancel_subscription((select id from billing_targets where label='demo-instructor-a'));
select public.mock_activate_subscription((select id from billing_targets where label='demo-instructor-a'));

select set_config('request.jwt.claim.sub','b1000000-0000-0000-0000-000000000005',false);
select pg_temp.expect_billing_denied('mock_activate_subscription',id) from billing_targets where label<>'demo-a';
select pg_temp.expect_billing_denied('cancel_subscription',id) from billing_targets where label<>'demo-a';
select public.mock_activate_subscription((select id from billing_targets where label='demo-a'));
select public.cancel_subscription((select id from billing_targets where label='demo-a'));
select public.mock_activate_subscription((select id from billing_targets where label='demo-a'));
reset role;
do $$ begin
  if exists (select 1 from billing_targets t join public.subscriptions s on s.id=t.id
             where s.trial_ends_at is distinct from t.trial_ends_at) then
    raise exception 'FAIL: trial dates were changed';
  end if;
  if not exists (select 1 from public.subscriptions s join billing_targets t on t.id=s.id
                 where t.label='real-b' and s.status='active' and s.current_period_end>now()) then
    raise exception 'FAIL: existing active rights changed';
  end if;
  if exists (select 1 from public.billing_events e join billing_targets t on t.id=e.subscription_id
             where e.event_type='mock_payment_succeeded' and t.label not in ('demo-a','demo-instructor-a')) then
    raise exception 'FAIL: unauthorized payment event';
  end if;
  if (select count(*) from public.billing_events e join billing_targets t on t.id=e.subscription_id
       where e.event_type='mock_payment_succeeded') <> 4 then
    raise exception 'FAIL: demo mock payment flow did not work';
  end if;
  if has_function_privilege('anon','public.mock_activate_subscription(uuid)','execute')
     or has_function_privilege('anon','public.cancel_subscription(uuid)','execute') then
    raise exception 'FAIL: anon can mutate billing';
  end if;
end $$;
update public.demo_sessions set created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour'
where id='bd000000-0000-0000-0000-000000000001';
set role authenticated;
select set_config('request.jwt.claim.sub','b1000000-0000-0000-0000-000000000005',false);
select pg_temp.expect_billing_denied('mock_activate_subscription',(select id from billing_targets where label='demo-a'));
select set_config('request.jwt.claim.sub','',false);
select pg_temp.expect_billing_denied('cancel_subscription',(select id from billing_targets where label='demo-a'));
select pg_temp.expect_billing_denied('mock_activate_subscription',(select id from billing_targets where label='demo-a'));
reset role;
rollback;
select 'BILLING SECURITY TESTS GESLAAGD' as resultaat;
