-- Preserve the existing central business checks verbatim in the non-exposed
-- schema. Public callers get an authorization boundary, internal workflows keep
-- their existing rules (including instructor-proposed replacements).
do $internal_checks$
declare
  v_name text;
  v_definition text;
begin
  foreach v_name in array array['has_valid_vog', 'has_pending_review'] loop
    select pg_get_functiondef(to_regprocedure(format('public.%I(uuid)', v_name)))
      into strict v_definition;
    execute replace(v_definition, 'FUNCTION public.', 'FUNCTION private.');
    execute format('revoke all on function private.%I(uuid) from public, anon, authenticated', v_name);
  end loop;

  -- Only these already-authorized SECURITY DEFINER workflows need internal
  -- checks. Keep pool RPCs SECURITY INVOKER and leave their public calls intact.
  for v_definition in
    select pg_get_functiondef(p.oid)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and p.proname = any(array[
        'apply_to_job', 'confirm_job', 'confirm_job_segments',
        'enforce_replacement_vog', 'invite_instructor', 'respond_invitation',
        'select_candidate', 'select_candidate_segments'
      ])
  loop
    execute replace(replace(v_definition,
      'public.has_valid_vog(', 'private.has_valid_vog('),
      'public.has_pending_review(', 'private.has_pending_review(');
  end loop;
end;
$internal_checks$;

create or replace function public.has_pending_review(target_user uuid)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not (coalesce(target_user = auth.uid(), false) or public.is_admin()) then
    raise exception using errcode = '42501', message = 'Geen toegang tot deze reviewstatus.';
  end if;
  return private.has_pending_review(target_user);
end;
$$;

create or replace function public.has_valid_vog(target_user uuid)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Geen toegang tot deze documentstatus.';
  end if;
  if target_user = auth.uid() or public.is_admin() then
    return private.has_valid_vog(target_user);
  end if;
  -- Candidate suggestions include instructors not yet invited/applied. Active
  -- organization members need this yes/no eligibility check, never documents.
  if not private.profile_in_demo_scope(target_user) or not exists (
    select 1 from public.instructor_profiles i where i.user_id = target_user
  ) or not exists (
    select 1 from public.profiles p
    join public.organization_members m on m.user_id = p.id and m.state = 'active'
    where p.id = auth.uid() and p.role = 'organization'
      and private.organization_in_demo_scope(m.organization_id)
  ) then
    raise exception using errcode = '42501', message = 'Geen toegang tot deze documentstatus.';
  end if;
  return private.has_valid_vog(target_user);
end;
$$;

revoke all on function public.has_valid_vog(uuid) from public, anon;
revoke all on function public.has_pending_review(uuid) from public, anon;
grant execute on function public.has_valid_vog(uuid) to authenticated;
grant execute on function public.has_pending_review(uuid) to authenticated;
