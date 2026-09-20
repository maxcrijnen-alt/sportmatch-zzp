-- Least-privilege hardening for the existing SportMatch schema.
--
-- The original schema correctly used RLS, but PostgreSQL grants EXECUTE on
-- newly created functions to PUBLIC by default. That made internal
-- SECURITY DEFINER helpers callable through the Data API. This migration
-- revokes that implicit access and only re-opens the RPCs used by the app.

-- Do not let new public functions silently become callable by every role.
alter default privileges in schema public
  revoke execute on functions from public;
alter default privileges in schema public
  revoke execute on functions from anon, authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;
revoke create on schema public from public;

-- RLS expressions need helper functions, but these helpers are not client
-- RPCs. Route the policies through a non-exposed schema so the authenticated
-- role can evaluate RLS without exposing the helpers at /rest/v1/rpc/*.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin();
$$;

create or replace function private.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_org_member(target_org);
$$;

create or replace function private.is_org_owner(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_org_owner(target_org);
$$;

create or replace function private.location_has_access(target_location uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.location_has_access(target_location);
$$;

create or replace function private.is_job_participant(target_job uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_job_participant(target_job);
$$;

create or replace function private.job_org(target_job uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select public.job_org(target_job);
$$;

create or replace function private.job_confirmed_instructor(target_job uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select public.job_confirmed_instructor(target_job);
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.is_org_owner(uuid) to authenticated;
grant execute on function private.location_has_access(uuid) to authenticated;
grant execute on function private.is_job_participant(uuid) to authenticated;
grant execute on function private.job_org(uuid) to authenticated;
grant execute on function private.job_confirmed_instructor(uuid) to authenticated;

-- Keep the existing policy names/commands/roles intact and only replace the
-- helper calls in USING/WITH CHECK expressions. This also covers the document
-- storage policies, which use the same admin helper.
do $$
declare
  policy_row record;
  using_expression text;
  check_expression text;
begin
  for policy_row in
    select
      p.polname,
      n.nspname as schema_name,
      c.relname as table_name,
      pg_get_expr(p.polqual, p.polrelid) as using_expression,
      pg_get_expr(p.polwithcheck, p.polrelid) as check_expression
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'storage')
  loop
    using_expression := policy_row.using_expression;
    check_expression := policy_row.check_expression;

    if using_expression is not null then
      using_expression := replace(using_expression, 'public.is_admin()', 'private.is_admin()');
      using_expression := replace(using_expression, 'public.is_org_member(', 'private.is_org_member(');
      using_expression := replace(using_expression, 'public.is_org_owner(', 'private.is_org_owner(');
      using_expression := replace(using_expression, 'public.location_has_access(', 'private.location_has_access(');
      using_expression := replace(using_expression, 'public.is_job_participant(', 'private.is_job_participant(');
      using_expression := replace(using_expression, 'public.job_org(', 'private.job_org(');
      using_expression := replace(using_expression, 'public.job_confirmed_instructor(', 'private.job_confirmed_instructor(');
      -- pg_get_expr normally omits the public schema for visible functions.
      using_expression := regexp_replace(using_expression, '(^|[^.[:alnum:]_])is_admin\(\)', '\1private.is_admin()', 'g');
      using_expression := regexp_replace(using_expression, '(^|[^.[:alnum:]_])is_org_member\(', '\1private.is_org_member(', 'g');
      using_expression := regexp_replace(using_expression, '(^|[^.[:alnum:]_])is_org_owner\(', '\1private.is_org_owner(', 'g');
      using_expression := regexp_replace(using_expression, '(^|[^.[:alnum:]_])location_has_access\(', '\1private.location_has_access(', 'g');
      using_expression := regexp_replace(using_expression, '(^|[^.[:alnum:]_])is_job_participant\(', '\1private.is_job_participant(', 'g');
      using_expression := regexp_replace(using_expression, '(^|[^.[:alnum:]_])job_org\(', '\1private.job_org(', 'g');
      using_expression := regexp_replace(using_expression, '(^|[^.[:alnum:]_])job_confirmed_instructor\(', '\1private.job_confirmed_instructor(', 'g');
    end if;

    if check_expression is not null then
      check_expression := replace(check_expression, 'public.is_admin()', 'private.is_admin()');
      check_expression := replace(check_expression, 'public.is_org_member(', 'private.is_org_member(');
      check_expression := replace(check_expression, 'public.is_org_owner(', 'private.is_org_owner(');
      check_expression := replace(check_expression, 'public.location_has_access(', 'private.location_has_access(');
      check_expression := replace(check_expression, 'public.is_job_participant(', 'private.is_job_participant(');
      check_expression := replace(check_expression, 'public.job_org(', 'private.job_org(');
      check_expression := replace(check_expression, 'public.job_confirmed_instructor(', 'private.job_confirmed_instructor(');
      check_expression := regexp_replace(check_expression, '(^|[^.[:alnum:]_])is_admin\(\)', '\1private.is_admin()', 'g');
      check_expression := regexp_replace(check_expression, '(^|[^.[:alnum:]_])is_org_member\(', '\1private.is_org_member(', 'g');
      check_expression := regexp_replace(check_expression, '(^|[^.[:alnum:]_])is_org_owner\(', '\1private.is_org_owner(', 'g');
      check_expression := regexp_replace(check_expression, '(^|[^.[:alnum:]_])location_has_access\(', '\1private.location_has_access(', 'g');
      check_expression := regexp_replace(check_expression, '(^|[^.[:alnum:]_])is_job_participant\(', '\1private.is_job_participant(', 'g');
      check_expression := regexp_replace(check_expression, '(^|[^.[:alnum:]_])job_org\(', '\1private.job_org(', 'g');
      check_expression := regexp_replace(check_expression, '(^|[^.[:alnum:]_])job_confirmed_instructor\(', '\1private.job_confirmed_instructor(', 'g');
    end if;

    if using_expression is distinct from policy_row.using_expression
      or check_expression is distinct from policy_row.check_expression then
      execute format(
        'alter policy %I on %I.%I%s%s',
        policy_row.polname,
        policy_row.schema_name,
        policy_row.table_name,
        case
          when using_expression is null then ''
          else format(' using (%s)', using_expression)
        end,
        case
          when check_expression is null then ''
          else format(' with check (%s)', check_expression)
        end
      );
    end if;
  end loop;
end;
$$;

-- Contact data is no longer selectable from the base tables. Authenticated
-- users keep access to the non-sensitive directory fields needed by listings.
-- Full rows are returned only by the guarded RPCs below.
revoke select on table public.profiles from anon, authenticated;
grant select (
  id, role, full_name, avatar_url, city_id,
  onboarding_completed, created_at, updated_at
) on table public.profiles to authenticated;

revoke select on table public.organizations from anon, authenticated;
grant select (
  id, name, org_type, created_by, created_at, updated_at
) on table public.organizations to authenticated;

create or replace function public.get_my_profile()
returns setof public.profiles
language sql
stable
security definer
set search_path = ''
rows 1
as $$
  select p.*
  from public.profiles p
  where p.id = auth.uid();
$$;

create or replace function public.get_organization_private(p_organization uuid)
returns setof public.organizations
language sql
stable
security definer
set search_path = ''
rows 1
as $$
  select o.*
  from public.organizations o
  where o.id = p_organization
    and (
      public.is_org_member(o.id)
      or public.is_admin()
    );
$$;

create or replace function public.admin_list_profiles()
returns setof public.profiles
language sql
stable
security definer
set search_path = ''
as $$
  select p.*
  from public.profiles p
  where public.is_admin();
$$;

create or replace function public.admin_list_organizations()
returns setof public.organizations
language sql
stable
security definer
set search_path = ''
as $$
  select o.*
  from public.organizations o
  where public.is_admin();
$$;

revoke all on function public.get_my_profile() from public, anon;
revoke all on function public.get_organization_private(uuid) from public, anon;
revoke all on function public.admin_list_profiles() from public, anon;
revoke all on function public.admin_list_organizations() from public, anon;

-- Explicit application API. Everything not listed here remains unavailable
-- to anon/authenticated, including internal_notify*, internal_ensure_chat,
-- internal_system_message, trigger functions and RLS helpers.
grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.get_organization_private(uuid) to authenticated;
grant execute on function public.admin_list_profiles() to authenticated;
grant execute on function public.admin_list_organizations() to authenticated;
grant execute on function public.instructor_public_stats(uuid) to authenticated;
grant execute on function public.open_job_matches() to authenticated;
grant execute on function public.apply_to_job(uuid, text, text) to authenticated;
grant execute on function public.withdraw_application(uuid) to authenticated;
grant execute on function public.invite_instructor(uuid, uuid, text) to authenticated;
grant execute on function public.respond_invitation(uuid, boolean, text) to authenticated;
grant execute on function public.create_counteroffer(uuid, public.pay_type, integer, text) to authenticated;
grant execute on function public.respond_counteroffer(uuid, boolean) to authenticated;
grant execute on function public.select_candidate(uuid, jsonb) to authenticated;
grant execute on function public.confirm_job(uuid) to authenticated;
grant execute on function public.get_job_contact_details(uuid) to authenticated;
grant execute on function public.send_chat_message(uuid, text) to authenticated;
grant execute on function public.cancel_confirmed_job(uuid, text) to authenticated;
grant execute on function public.propose_replacement(uuid, uuid, text) to authenticated;
grant execute on function public.decide_replacement(uuid, boolean) to authenticated;
grant execute on function public.record_no_show(uuid, text) to authenticated;
grant execute on function public.complete_job(uuid) to authenticated;
grant execute on function public.submit_review(uuid, integer) to authenticated;
grant execute on function public.mock_activate_subscription(uuid) to authenticated;
grant execute on function public.cancel_subscription(uuid) to authenticated;
grant execute on function public.admin_set_subscription_status(
  uuid, public.subscription_status, integer
) to authenticated;
grant execute on function public.refresh_document_statuses() to authenticated;

comment on function public.get_job_contact_details(uuid) is
  'Returns counterparty contact details only after final confirmation and only to a job participant.';
