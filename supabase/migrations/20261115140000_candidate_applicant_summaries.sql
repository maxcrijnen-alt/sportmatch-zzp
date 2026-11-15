-- Applicant summaries for the paginated "Reacties" inbox on
-- /organisatie/kandidaten.
--
-- The inbox pages its applications in the application (20 per page, stable
-- order, exact count). For the instructors on the current page it needs
-- rating, reliability and pool status: this returns exactly those, in one
-- bounded, set-based call. Cost depends on the page, not on all instructors
-- or all applications, and no response can exceed the API row limit.
--
-- Additive only; search_organization_candidates is unchanged.

-- ---------------------------------------------------------------------------
-- Statistics for a given set of instructors, set based.
-- Mirrors public.instructor_public_stats (same formula, released reviews
-- only, segment confirmations counted once per job); parity is covered by
-- supabase/tests/candidate_discovery_test.sql. Internal helper without its
-- own scope check: only SECURITY DEFINER functions that already authorized
-- the caller and scoped the ids may call it.
-- ---------------------------------------------------------------------------
create function private.instructor_stats(p_ids uuid[])
returns table (
  user_id uuid,
  avg_rating numeric,
  review_count bigint,
  completed_count bigint,
  reliability_score numeric
)
language sql
stable
set search_path = ''
as $$
  with ids as materialized (
    select distinct id as uid from unnest(p_ids) as id where id is not null
  ),
  confirmed_jobs as materialized (
    select jc.instructor_id as uid, jc.job_id
    from public.job_confirmations jc
    join ids on ids.uid = jc.instructor_id
    where jc.confirmed_at is not null
    union
    select sc.instructor_id, sc.job_id
    from public.job_segment_confirmations sc
    join ids on ids.uid = sc.instructor_id
    where sc.confirmed_at is not null and sc.cancelled_at is null
  ),
  job_stats as materialized (
    select cj.uid,
           count(*) as confirmed,
           count(*) filter (where j.status = 'completed') as completed
    from confirmed_jobs cj
    left join public.jobs j on j.id = cj.job_id
    group by cj.uid
  ),
  cancellation_stats as materialized (
    select ca.cancelled_by as uid, count(*) as n
    from public.cancellations ca
    join ids on ids.uid = ca.cancelled_by
    where ca.side = 'instructor'
    group by ca.cancelled_by
  ),
  no_show_stats as materialized (
    select ns.instructor_id as uid, count(*) as n
    from public.no_show_records ns
    join ids on ids.uid = ns.instructor_id
    group by ns.instructor_id
  ),
  review_stats as materialized (
    select r.reviewee_id as uid,
           avg(r.rating)::numeric(3, 2) as avg_rating,
           count(*) as n
    from public.reviews r
    join ids on ids.uid = r.reviewee_id
    where r.released_at is not null
    group by r.reviewee_id
  )
  select ids.uid,
         rs.avg_rating,
         coalesce(rs.n, 0),
         coalesce(js.completed, 0),
         case
           when coalesce(js.confirmed, 0) = 0 then null
           else round(
             greatest(0, least(100,
               (js.completed::numeric / js.confirmed) * 55
               + coalesce(rs.avg_rating / 5, 0.7) * 45
               - coalesce(nss.n, 0) * 15
               - coalesce(cs.n, 0) * 5
             )), 0)
         end
  from ids
  left join job_stats js on js.uid = ids.uid
  left join cancellation_stats cs on cs.uid = ids.uid
  left join no_show_stats nss on nss.uid = ids.uid
  left join review_stats rs on rs.uid = ids.uid;
$$;

revoke all on function private.instructor_stats(uuid[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- organization_applicant_summaries
--
-- Audience and checks are identical to search_organization_candidates:
-- organization role, active membership of p_organization, same demo scope.
-- p_instructors holds the instructor ids of one inbox page (at most 100).
-- Only ids with a pending application on this organization's jobs and inside
-- the caller's scope are returned, so the function cannot be used to look up
-- arbitrary instructors. Only fields the inbox shows; no birth date, contact
-- details, KvK/btw or documents.
-- ---------------------------------------------------------------------------
create function public.organization_applicant_summaries(
  p_organization uuid,
  p_instructors uuid[]
)
returns table (
  user_id uuid,
  full_name text,
  avatar_url text,
  avg_rating numeric,
  review_count bigint,
  completed_count bigint,
  reliability_score numeric,
  in_pool boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_demo_session uuid;
begin
  if auth.uid() is null
     or not exists (
       select 1 from public.profiles me
       where me.id = auth.uid() and me.role = 'organization'
     )
     or not private.is_org_member(p_organization)
     or not private.organization_in_demo_scope(p_organization) then
    raise exception using errcode = '42501',
      message = 'Geen toegang tot de kandidaten van deze organisatie.';
  end if;

  if p_instructors is null or coalesce(cardinality(p_instructors), 0) > 100 then
    raise exception using errcode = '22023',
      message = 'Vraag samenvattingen op voor maximaal 100 instructeurs tegelijk.';
  end if;

  -- Organization role: demo_scope_matches reduces to the caller's session.
  v_demo_session := public.current_demo_session_id();

  return query
  with requested as materialized (
    select distinct id as uid from unnest(p_instructors) as id where id is not null
  ),
  applicants as materialized (
    select p.id as uid, p.full_name as name, p.avatar_url as avatar
    from requested r
    join public.profiles p on p.id = r.uid
    where p.role = 'instructor'
      and p.demo_session_id is not distinct from v_demo_session
      and exists (
        select 1
        from public.job_applications a
        join public.jobs j on j.id = a.job_id
        where a.instructor_id = p.id
          and a.status = 'pending'
          and j.organization_id = p_organization
      )
  ),
  stats as materialized (
    select * from private.instructor_stats(array(select ap.uid from applicants ap))
  )
  select ap.uid, ap.name, ap.avatar,
         st.avg_rating, st.review_count, st.completed_count, st.reliability_score,
         exists (
           select 1 from public.organization_instructor_connections c
           where c.organization_id = p_organization and c.instructor_id = ap.uid
         )
  from applicants ap
  left join stats st on st.user_id = ap.uid
  order by ap.uid;
end;
$$;

revoke all on function public.organization_applicant_summaries(uuid, uuid[])
  from public, anon;
grant execute on function public.organization_applicant_summaries(uuid, uuid[])
  to authenticated;
