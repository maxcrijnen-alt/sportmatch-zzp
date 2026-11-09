-- Read minimization only. Existing INSERT/UPDATE grants and RLS stay intact.
-- A table-level SELECT grant overrides column restrictions, so remove both.
revoke select on public.instructor_profiles from public, anon, authenticated;
revoke select (user_id, birth_date, work_experience, years_experience,
               hourly_rate_cents, travel_distance_km, kvk_number, btw_number,
               created_at, updated_at)
  on public.instructor_profiles from public, anon, authenticated;
grant select (user_id, work_experience, years_experience, hourly_rate_cents,
              travel_distance_km, created_at, updated_at)
  on public.instructor_profiles to authenticated;

-- The existing scope policy still protects all direct safe-column queries,
-- embedded replacement-candidate joins and SECURITY INVOKER pool functions.
-- Raw administration is available only through this identity-checked API.
create function public.get_instructor_private_profile(p_instructor uuid)
returns table (
  user_id uuid,
  birth_date date,
  work_experience text,
  years_experience integer,
  hourly_rate_cents integer,
  travel_distance_km integer,
  kvk_number text,
  btw_number text
)
language sql stable security definer set search_path = ''
as $$
  select i.user_id, i.birth_date, i.work_experience, i.years_experience,
         i.hourly_rate_cents, i.travel_distance_km, i.kvk_number, i.btw_number
  from public.instructor_profiles i
  where i.user_id = p_instructor
    and auth.uid() is not null
    and (i.user_id = auth.uid() or private.is_admin())
    and private.profile_in_demo_scope(i.user_id);
$$;

-- Candidate details never return DOB or business identifiers. No caller-
-- supplied reference date: that would allow binary-searching an exact DOB.
-- Match the existing candidate/VOG audience: own preview, admins and active
-- organization members within the same demo/production scope.
create function public.get_instructor_candidate_profile(p_instructor uuid)
returns table (
  user_id uuid,
  age integer,
  work_experience text,
  years_experience integer,
  hourly_rate_cents integer,
  travel_distance_km integer
)
language sql stable security definer set search_path = ''
as $$
  select i.user_id,
         case when i.birth_date <= (now() at time zone 'Europe/Amsterdam')::date
              then extract(year from age((now() at time zone 'Europe/Amsterdam')::date, i.birth_date))::integer
              else null end,
         i.work_experience, i.years_experience, i.hourly_rate_cents,
         i.travel_distance_km
  from public.instructor_profiles i
  where i.user_id = p_instructor
    and auth.uid() is not null
    and private.profile_in_demo_scope(i.user_id)
    and (i.user_id = auth.uid() or private.is_admin() or exists (
      select 1 from public.profiles p
      join public.organization_members m on m.user_id = p.id and m.state = 'active'
      where p.id = auth.uid() and p.role = 'organization'
        and private.organization_in_demo_scope(m.organization_id)
    ));
$$;

revoke all on function public.get_instructor_private_profile(uuid)
  from public, anon, authenticated;
revoke all on function public.get_instructor_candidate_profile(uuid)
  from public, anon, authenticated;
grant execute on function public.get_instructor_private_profile(uuid) to authenticated;
grant execute on function public.get_instructor_candidate_profile(uuid) to authenticated;
