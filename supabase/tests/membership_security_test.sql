-- Disposable fixtures only. Never run this suite against a remote database.
\set ON_ERROR_STOP on
begin;

create function pg_temp.member_fixture(label text) returns uuid
language sql immutable as $$ select md5('membership-round1:' || label)::uuid $$;
create function pg_temp.member_user(label text) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub', pg_temp.member_fixture(label)::text, false);
  perform set_config('request.jwt.claim.email', label || '@membership.test', false);
end $$;
create function pg_temp.member_refused(statement text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  execute statement;
  raise exception 'FAIL: unauthorized membership operation was accepted';
exception when insufficient_privilege then null;
end $$;

insert into auth.users (id,email,email_confirmed_at,raw_user_meta_data)
select pg_temp.member_fixture(label), label || '@membership.test',
       case when label = 'unverified' then null else now() end,
       jsonb_build_object('role','organization','full_name',label)
from (values ('owner'),('other-owner'),('outsider'),('invitee'),('unverified'),('demo-a'),('demo-b')) u(label);
insert into public.demo_sessions(id) values (pg_temp.member_fixture('session-a')),(pg_temp.member_fixture('session-b'));
update public.profiles set demo_session_id = pg_temp.member_fixture('session-a') where id=pg_temp.member_fixture('demo-a');
update public.profiles set demo_session_id = pg_temp.member_fixture('session-b') where id=pg_temp.member_fixture('demo-b');
insert into public.organizations(id,name,org_type,created_by,demo_session_id) values
  (pg_temp.member_fixture('org'),'Membership test','gym',pg_temp.member_fixture('owner'),null),
  (pg_temp.member_fixture('other-org'),'Other membership test','gym',pg_temp.member_fixture('other-owner'),null),
  (pg_temp.member_fixture('former-org'),'Transferred organization','gym',pg_temp.member_fixture('outsider'),null),
  (pg_temp.member_fixture('org-a'),'Demo A','gym',pg_temp.member_fixture('demo-a'),pg_temp.member_fixture('session-a')),
  (pg_temp.member_fixture('org-b'),'Demo B','gym',pg_temp.member_fixture('demo-b'),pg_temp.member_fixture('session-b'));
insert into public.organization_members(organization_id,user_id,member_role) values
  (pg_temp.member_fixture('other-org'),pg_temp.member_fixture('other-owner'),'owner'),
  (pg_temp.member_fixture('former-org'),pg_temp.member_fixture('other-owner'),'owner');

-- A new organization's creator still bootstraps its first owner via RLS.
select pg_temp.member_user('owner');
set role authenticated;
insert into public.organization_members(organization_id,user_id,member_role)
values (pg_temp.member_fixture('org'),auth.uid(),'owner');
-- A legitimate owner creates fixed-role invitations, never the invitee.
insert into public.organization_members(id,organization_id,invited_email,member_role,state) values
  (pg_temp.member_fixture('invite'),pg_temp.member_fixture('org'),'invitee@membership.test','planner','invited'),
  (pg_temp.member_fixture('unverified-invite'),pg_temp.member_fixture('org'),'unverified@membership.test','planner','invited'),
  (pg_temp.member_fixture('real-demo-invite'),pg_temp.member_fixture('org'),'demo-a@membership.test','planner','invited');

select pg_temp.member_user('outsider');
-- Reproduced baseline bypass: manufacture an active owner row with own email.
select pg_temp.member_refused($s$insert into public.organization_members(organization_id,user_id,invited_email,member_role,state)
  values(pg_temp.member_fixture('org'),auth.uid(),'outsider@membership.test','owner','active')$s$);
-- A former creator cannot reclaim an already initialized organization.
select pg_temp.member_refused($s$insert into public.organization_members(organization_id,user_id,member_role)
  values(pg_temp.member_fixture('former-org'),auth.uid(),'owner')$s$);
select pg_temp.member_refused($s$select public.accept_organization_invitation(pg_temp.member_fixture('invite'))$s$);
select pg_temp.member_refused($s$select public.accept_organization_invitation(pg_temp.member_fixture('missing'))$s$);

select pg_temp.member_user('invitee');
-- Direct update used to let an invitee set role/organization while accepting.
update public.organization_members set user_id=auth.uid(),state='active',member_role='owner'
  where id=pg_temp.member_fixture('invite');
do $$ begin
  if not exists(select 1 from public.organization_members where id=pg_temp.member_fixture('invite')
    and user_id is null and member_role='planner' and state='invited') then
    raise exception 'FAIL: direct invitation role escalation succeeded';
  end if;
end $$;

select pg_temp.member_user('unverified');
select pg_temp.member_refused($s$select public.accept_organization_invitation(pg_temp.member_fixture('unverified-invite'))$s$);
reset role;
do $$ begin
  if (select onboarding_completed from public.profiles where id=pg_temp.member_fixture('unverified')) then
    raise exception 'FAIL: failed acceptance completed onboarding';
  end if;
end $$;

select pg_temp.member_user('invitee');
set role authenticated;
select public.accept_organization_invitation(pg_temp.member_fixture('invite'));
select public.accept_organization_invitation(pg_temp.member_fixture('invite'));
do $$ begin
  if not exists(select 1 from public.organization_members where id=pg_temp.member_fixture('invite')
    and user_id=auth.uid() and member_role='planner' and state='active') then
    raise exception 'FAIL: legitimate acceptance did not preserve invited role';
  end if;
  if not (select onboarding_completed from public.profiles where id=auth.uid()) then
    raise exception 'FAIL: successful acceptance did not complete onboarding';
  end if;
end $$;
update public.organization_members set member_role='owner',organization_id=pg_temp.member_fixture('other-org')
  where id=pg_temp.member_fixture('invite');
reset role;
do $$ begin
  if not exists(select 1 from public.organization_members where id=pg_temp.member_fixture('invite')
    and organization_id=pg_temp.member_fixture('org') and member_role='planner') then
    raise exception 'FAIL: planner changed own role or organization';
  end if;
end $$;

-- Existing owner management remains available; removed members cannot reactivate.
select pg_temp.member_user('owner');
set role authenticated;
update public.organization_members set member_role='location_manager',state='removed' where id=pg_temp.member_fixture('invite');
select pg_temp.member_user('invitee');
update public.organization_members set state='active' where id=pg_temp.member_fixture('invite');
select pg_temp.member_refused($s$select public.accept_organization_invitation(pg_temp.member_fixture('invite'))$s$);
reset role;
do $$ begin
  if not exists(select 1 from public.organization_members where id=pg_temp.member_fixture('invite')
    and member_role='location_manager' and state='removed') then
    raise exception 'FAIL: owner management or removal isolation failed';
  end if;
end $$;

-- Same-email invites in another demo session or the real scope remain inaccessible.
insert into public.organization_members(id,organization_id,invited_email,member_role,state) values
  (pg_temp.member_fixture('cross-demo-invite'),pg_temp.member_fixture('org-b'),'demo-a@membership.test','planner','invited');
select pg_temp.member_user('demo-a');
set role authenticated;
insert into public.organization_members(organization_id,user_id,member_role)
values (pg_temp.member_fixture('org-a'),auth.uid(),'owner');
select pg_temp.member_refused($s$select public.accept_organization_invitation(pg_temp.member_fixture('cross-demo-invite'))$s$);
select pg_temp.member_refused($s$select public.accept_organization_invitation(pg_temp.member_fixture('real-demo-invite'))$s$);

select set_config('request.jwt.claim.sub','',false);
select pg_temp.member_refused($s$select public.accept_organization_invitation(pg_temp.member_fixture('invite'))$s$);
reset role;
do $$ begin
  if has_function_privilege('anon','public.accept_organization_invitation(uuid)','execute') then
    raise exception 'FAIL: anon can execute invitation acceptance';
  end if;
  if has_function_privilege('anon','private.can_initialize_organization_owner(uuid)','execute') then
    raise exception 'FAIL: anon can execute initialization helper';
  end if;
  if exists(select 1 from public.organization_members where user_id=pg_temp.member_fixture('outsider')) then
    raise exception 'FAIL: outsider acquired a membership';
  end if;
end $$;

rollback;
select 'MEMBERSHIP SECURITY TESTS PASSED' as result;

