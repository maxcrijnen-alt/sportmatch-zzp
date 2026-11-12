-- Synthetic fixtures in a disposable database only; never run on production.
\set ON_ERROR_STOP on
begin;

create function pg_temp.privacy_id(label text) returns uuid
language sql immutable as $$ select md5('instructor-privacy-' || label)::uuid $$;
grant execute on function pg_temp.privacy_id(text) to anon, authenticated;

insert into auth.users(id, email, raw_user_meta_data)
select pg_temp.privacy_id(label), label || '@privacy.test',
       jsonb_build_object('role', role, 'full_name', 'Synthetic ' || label)
from (values ('a','instructor'), ('b','instructor'), ('school','organization'),
             ('admin','instructor'), ('demo-a','instructor'), ('demo-b','instructor'),
             ('demo-school','organization')) f(label,role);
update public.profiles set role='admin' where id=pg_temp.privacy_id('admin');
insert into public.demo_sessions(id, expires_at)
values(pg_temp.privacy_id('session-a'),now()+interval '1 day'),
      (pg_temp.privacy_id('session-b'),now()+interval '1 day');
update public.profiles set demo_session_id=pg_temp.privacy_id('session-a')
where id in (pg_temp.privacy_id('demo-a'),pg_temp.privacy_id('demo-school'));
update public.profiles set demo_session_id=pg_temp.privacy_id('session-b')
where id=pg_temp.privacy_id('demo-b');
insert into public.instructor_profiles(user_id,birth_date,kvk_number,btw_number,
                                     years_experience,work_experience,hourly_rate_cents)
select pg_temp.privacy_id(label),'1990-03-14','12345678','SYNTHETIC-VAT',5,
       'Synthetic work experience',4500
from (values ('a'),('b'),('demo-a'),('demo-b')) f(label);
insert into public.organizations(id,name,org_type,created_by,demo_session_id)
select pg_temp.privacy_id(label||'-org'),'Synthetic '||label,'gym',
       pg_temp.privacy_id(label),session_id
from (values ('school',null::uuid),('demo-school',pg_temp.privacy_id('session-a'))) f(label,session_id);
insert into public.organization_members(organization_id,user_id,member_role)
select pg_temp.privacy_id(label||'-org'),pg_temp.privacy_id(label),'owner'
from (values ('school'),('demo-school')) f(label);

create function pg_temp.privacy_denied(statement text) returns void
language plpgsql security invoker set search_path='' as $$
begin
  begin
    execute statement;
  exception when insufficient_privilege then
    return;
  end;
  raise exception 'FAIL: private instructor data was readable: %',statement;
end $$;
grant execute on function pg_temp.privacy_denied(text) to anon,authenticated;

-- This assertion fails on main before the new migration: B can read A's DOB.
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.privacy_id('b')::text,true);
select pg_temp.privacy_denied($q$select birth_date from public.instructor_profiles$q$);
select pg_temp.privacy_denied($q$select kvk_number,btw_number from public.instructor_profiles$q$);
select pg_temp.privacy_denied($q$select to_jsonb(i) from public.instructor_profiles i$q$);
select pg_temp.privacy_denied($q$select user_id from public.instructor_profiles where birth_date='1990-03-14'$q$);
do $$ begin
  if exists(select 1 from public.get_instructor_private_profile(pg_temp.privacy_id('a'))) then
    raise exception 'FAIL: B can read A through private RPC';
  end if;
end $$;

-- Own reads and existing INSERT/UPDATE authorization remain usable.
select set_config('request.jwt.claim.sub',pg_temp.privacy_id('a')::text,true);
do $$ begin
  if not exists(select 1 from public.get_instructor_private_profile(auth.uid())
                where birth_date='1990-03-14' and kvk_number='12345678' and btw_number='SYNTHETIC-VAT') then
    raise exception 'FAIL: own private profile missing';
  end if;
end $$;
update public.instructor_profiles set birth_date='1991-03-14',kvk_number='87654321'
where user_id=auth.uid();
update public.instructor_profiles
set birth_date='1992-03-14',kvk_number='11223344',btw_number='UPDATED-SYNTHETIC-VAT'
where user_id=auth.uid();
-- ON CONFLICT requires SELECT on private columns; app saves use INSERT/UPDATE.
select pg_temp.privacy_denied($q$
  insert into public.instructor_profiles(user_id,kvk_number)
  values(auth.uid(),'UPSERT-MUST-NOT-REOPEN-SELECT')
  on conflict(user_id) do update set kvk_number=excluded.kvk_number
$q$);
do $$ begin
  if not exists(select 1 from public.get_instructor_private_profile(auth.uid())
                where birth_date='1992-03-14' and kvk_number='11223344' and btw_number='UPDATED-SYNTHETIC-VAT') then
    raise exception 'FAIL: own private update regressed';
  end if;
  if not exists(select 1 from public.get_instructor_candidate_profile(auth.uid())
                where age=extract(year from age((now() at time zone 'Europe/Amsterdam')::date,date '1992-03-14'))::integer) then
    raise exception 'FAIL: own candidate preview age is wrong';
  end if;
end $$;
-- Null, future and birthday boundaries are computed in Amsterdam, independent
-- of the database session's time zone. No exact date enters the public row.
set local time zone 'Pacific/Honolulu';
update public.instructor_profiles
set birth_date=((now() at time zone 'Europe/Amsterdam')::date - interval '30 years')::date
where user_id=auth.uid();
do $$ begin
  if (select age from public.get_instructor_candidate_profile(auth.uid())) <> 30 then
    raise exception 'FAIL: birthday age or business timezone is wrong';
  end if;
end $$;
update public.instructor_profiles set birth_date=null where user_id=auth.uid();
do $$ begin
  if (select age from public.get_instructor_candidate_profile(auth.uid())) is not null then
    raise exception 'FAIL: missing DOB acquired a fabricated age';
  end if;
end $$;
update public.instructor_profiles set birth_date=date '2099-01-01' where user_id=auth.uid();
do $$ begin
  if (select age from public.get_instructor_candidate_profile(auth.uid())) is not null then
    raise exception 'FAIL: future DOB acquired a negative age';
  end if;
end $$;
update public.instructor_profiles set birth_date=date '1992-03-14' where user_id=auth.uid();

-- Schools retain the minimal catalogue, never administrative fields.
select set_config('request.jwt.claim.sub',pg_temp.privacy_id('school')::text,true);
select pg_temp.privacy_denied($q$select birth_date,kvk_number,btw_number from public.instructor_profiles$q$);
do $$ begin
  if exists(select 1 from public.get_instructor_private_profile(pg_temp.privacy_id('a'))) then
    raise exception 'FAIL: school can read private administration';
  end if;
  if not exists(select 1 from public.get_instructor_candidate_profile(pg_temp.privacy_id('a'))
                where years_experience=5 and hourly_rate_cents=4500 and age is not null) then
    raise exception 'FAIL: school lost safe candidate details';
  end if;
  if exists(select 1 from public.instructor_profiles where user_id=pg_temp.privacy_id('demo-a')) then
    raise exception 'FAIL: production reads demo catalogue';
  end if;
  if exists(select 1 from public.get_instructor_candidate_profile(pg_temp.privacy_id('demo-a'))) then
    raise exception 'FAIL: candidate RPC crosses production/demo boundary';
  end if;
end $$;

-- Non-owners still cannot update a target's private columns.
update public.instructor_profiles set kvk_number='ILLEGAL' where user_id=pg_temp.privacy_id('a');
select set_config('request.jwt.claim.sub',pg_temp.privacy_id('admin')::text,true);
do $$ begin
  if not exists(select 1 from public.get_instructor_private_profile(pg_temp.privacy_id('a'))
                where kvk_number='11223344') then
    raise exception 'FAIL: admin administration or non-owner update protection regressed';
  end if;
end $$;

select set_config('request.jwt.claim.sub',pg_temp.privacy_id('demo-a')::text,true);
do $$ begin
  if not exists(select 1 from public.get_instructor_private_profile(auth.uid())) then
    raise exception 'FAIL: demo lost own private profile';
  end if;
  if exists(select 1 from public.get_instructor_private_profile(pg_temp.privacy_id('a')))
     or exists(select 1 from public.get_instructor_private_profile(pg_temp.privacy_id('demo-b')))
     or exists(select 1 from public.instructor_profiles where user_id in (pg_temp.privacy_id('a'),pg_temp.privacy_id('demo-b')))
     or exists(select 1 from public.get_instructor_candidate_profile(pg_temp.privacy_id('a')))
     or exists(select 1 from public.get_instructor_candidate_profile(pg_temp.privacy_id('demo-b'))) then
    raise exception 'FAIL: demo crosses another session or production boundary';
  end if;
end $$;
select set_config('request.jwt.claim.sub',pg_temp.privacy_id('demo-school')::text,true);
do $$ begin
  if not exists(select 1 from public.get_instructor_candidate_profile(pg_temp.privacy_id('demo-a')))
     or exists(select 1 from public.get_instructor_candidate_profile(pg_temp.privacy_id('demo-b')))
     or exists(select 1 from public.get_instructor_candidate_profile(pg_temp.privacy_id('a'))) then
    raise exception 'FAIL: demo school catalogue isolation regressed';
  end if;
end $$;

set local role anon;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.privacy_denied($q$select birth_date,kvk_number,btw_number from public.instructor_profiles$q$);
select pg_temp.privacy_denied($q$select * from public.get_instructor_private_profile(null)$q$);
select pg_temp.privacy_denied($q$select * from public.get_instructor_candidate_profile(null)$q$);

reset role;
-- Future schema additions and composite-returning APIs must not silently reopen access.
do $$ begin
  if has_table_privilege('authenticated','public.instructor_profiles','SELECT')
     or has_column_privilege('authenticated','public.instructor_profiles','birth_date','SELECT')
     or has_column_privilege('authenticated','public.instructor_profiles','kvk_number','SELECT')
     or has_column_privilege('authenticated','public.instructor_profiles','btw_number','SELECT') then
    raise exception 'FAIL: broad table/column SELECT remains';
  end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
            where n.nspname='public' and p.prorettype='public.instructor_profiles'::regtype
              and has_function_privilege('authenticated',p.oid,'EXECUTE')
              and p.oid<>'public.get_instructor_private_profile(uuid)'::regprocedure) then
    raise exception 'FAIL: alternate private composite API';
  end if;
end $$;

rollback;
\echo 'INSTRUCTOR PRIVACY TESTS PASSED'
