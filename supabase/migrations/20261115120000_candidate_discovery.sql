-- Candidate discovery: one filtered, sorted and paginated search over every
-- relevant instructor for an organization.
--
-- Replaces client-side assembly on /organisatie/kandidaten that
--   * only read the first 100 (unordered) sport links,
--   * cut "passend" to 12 and "hoog beoordeeld" to 6 results,
--   * issued two RPCs per candidate (VOG + statistics).
-- Filtering, sorting, counting and paging now happen here, on the full set.
--
-- Additive only: no existing table, policy or function changes.

-- Weekly availability lookups per candidate.
create index if not exists availability_rules_user_idx
  on public.availability_rules (user_id);

-- ---------------------------------------------------------------------------
-- search_organization_candidates
--
-- Audience: an authenticated user with the organization role and an active
-- membership of p_organization, inside the same demo/production scope (the
-- audience of get_instructor_candidate_profile and has_valid_vog).
--
-- Candidate set: instructors in the caller's scope that either have a valid
-- VOG (they can be invited) or already relate to this organization (pool,
-- earlier collaboration, pending application or invitation). Each instructor
-- is returned at most once.
--
-- Returned fields are the ones the candidate list already showed: no birth
-- date, contact details, KvK/btw or documents. VOG is a yes/no flag, as
-- has_valid_vog returns it to this audience.
--
-- Everything is computed set based (no per-candidate function calls), so the
-- cost grows linearly with the number of instructors and open jobs. Three
-- parts mirror existing definitions and are covered by parity tests in
-- supabase/tests/candidate_discovery_test.sql:
--   * VOG validity        = private.has_valid_vog
--   * schedule conflicts  = public.instructor_has_schedule_conflict
--   * statistics          = public.instructor_public_stats
-- The match score is the formula the page computed before, unchanged.
--
-- Availability for a job uses existing data only:
--   unavailable  "not available" exception on the job date, a confirmed
--                overlapping job (selection refuses those as well), or weekly
--                rules exist and none covers the job time
--   available    "available" exception, or a covering weekly rule
--   unknown      no exception and no weekly rules
-- ---------------------------------------------------------------------------
create function public.search_organization_candidates(
  p_organization uuid,
  p_location uuid default null,
  p_job uuid default null,
  p_query text default null,
  p_sport uuid default null,
  p_lesson_type uuid default null,
  p_availability text default null,
  p_min_rating numeric default null,
  p_min_experience integer default null,
  p_max_distance integer default null,
  p_relation text default null,
  p_min_reliability integer default null,
  p_include_unrated boolean default false,
  p_only_matching boolean default false,
  p_sort text default 'match',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  full_name text,
  avatar_url text,
  city_name text,
  years_experience integer,
  sport_ids uuid[],
  lesson_type_ids uuid[],
  has_valid_vog boolean,
  avg_rating numeric,
  review_count bigint,
  completed_count bigint,
  reliability_score numeric,
  in_pool boolean,
  worked_before boolean,
  pending_application_job_id uuid,
  invited_pending boolean,
  action_job_id uuid,
  applied_to_action_job boolean,
  invited_to_action_job boolean,
  match_job_id uuid,
  match_score integer,
  availability text,
  distance_km numeric,
  total_count bigint,
  page_offset integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_sort text := coalesce(p_sort, 'match');
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
  v_pattern text;
  v_job_location uuid;
  v_demo_session uuid;
  v_today date := (now() at time zone 'Europe/Amsterdam')::date;
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

  if p_location is not null and not exists (
    select 1 from public.organization_locations l
    where l.id = p_location and l.organization_id = p_organization
  ) then
    raise exception using errcode = '42501',
      message = 'Vestiging niet gevonden of geen toegang.';
  end if;

  if p_job is not null then
    select j.location_id into v_job_location
    from public.jobs j
    where j.id = p_job
      and j.organization_id = p_organization
      and j.status = 'open'
      and (p_location is null or j.location_id = p_location);
    if v_job_location is null then
      raise exception using errcode = '42501',
        message = 'Opdracht niet gevonden of geen toegang.';
    end if;
  end if;

  if v_sort not in ('match', 'rating', 'reliability', 'experience', 'distance') then
    raise exception using errcode = '22023', message = 'Onbekende sortering.';
  end if;
  if p_availability is not null
     and p_availability not in ('available', 'unknown', 'unavailable') then
    raise exception using errcode = '22023', message = 'Onbekende beschikbaarheid.';
  end if;
  if p_availability is not null and p_job is null then
    raise exception using errcode = '22023',
      message = 'Kies een opdracht om op beschikbaarheid te filteren.';
  end if;
  if p_relation is not null
     and p_relation not in ('pool', 'worked', 'applied', 'invited') then
    raise exception using errcode = '22023', message = 'Onbekende relatie.';
  end if;
  if (p_min_rating is not null and (p_min_rating < 1 or p_min_rating > 5))
     or (p_min_experience is not null and (p_min_experience < 0 or p_min_experience > 60))
     or (p_max_distance is not null and (p_max_distance < 1 or p_max_distance > 250))
     or (p_min_reliability is not null and (p_min_reliability < 0 or p_min_reliability > 100))
     or char_length(coalesce(v_query, '')) > 100 then
    raise exception using errcode = '22023', message = 'Ongeldige filterwaarde.';
  end if;

  if v_query is not null then
    v_pattern := '%' || replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  -- The caller has the organization role, so demo_scope_matches reduces to
  -- comparing against the caller's own demo session (NULL for production).
  v_demo_session := public.current_demo_session_id();

  -- CTEs are MATERIALIZED on purpose: each is evaluated exactly once, also
  -- when row estimates are poor, so no step is repeated inside a nested loop.
  return query
  with
  org_locations as materialized (
    select l.id, c.lat, c.lng
    from public.organization_locations l
    left join public.cities c on c.id = l.city_id
    where l.organization_id = p_organization
  ),
  -- Distance reference: the selected job, else the selected location, else
  -- the nearest location of the organization.
  reference_points as materialized (
    select ol.lat, ol.lng
    from org_locations ol
    where ol.lat is not null and ol.lng is not null
      and case
        when v_job_location is not null then ol.id = v_job_location
        when p_location is not null then ol.id = p_location
        else true
      end
  ),
  target_jobs as materialized (
    select j.id, j.sport_id, j.lesson_type_id, j.starts_on, j.start_time, j.end_time,
           extract(dow from j.starts_on)::smallint as weekday,
           ol.lat, ol.lng,
           coalesce((
             select array_agg(distinct r.qualification_id)
             from public.job_requirements r
             where r.job_id = j.id
           ), '{}'::uuid[]) as requirements
    from public.jobs j
    join org_locations ol on ol.id = j.location_id
    where j.organization_id = p_organization
      and j.status = 'open'
      and (p_job is null or j.id = p_job)
      and (p_location is null or j.location_id = p_location)
  ),
  scoped_org_jobs as materialized (
    select j.id, j.status
    from public.jobs j
    where j.organization_id = p_organization
      and (p_location is null or j.location_id = p_location)
  ),
  pool as materialized (
    select distinct c.instructor_id as uid
    from public.organization_instructor_connections c
    where c.organization_id = p_organization
  ),
  worked as materialized (
    select jc.instructor_id as uid
    from public.job_confirmations jc
    join scoped_org_jobs j on j.id = jc.job_id and j.status = 'completed'
    where jc.confirmed_at is not null
    union
    select sc.instructor_id
    from public.job_segment_confirmations sc
    join scoped_org_jobs j on j.id = sc.job_id and j.status = 'completed'
    where sc.confirmed_at is not null and sc.cancelled_at is null
  ),
  pending_applications as materialized (
    select distinct on (a.instructor_id) a.instructor_id as uid, a.job_id
    from public.job_applications a
    join scoped_org_jobs j on j.id = a.job_id
    where a.status = 'pending'
      and (p_job is null or a.job_id = p_job)
    order by a.instructor_id, a.created_at desc, a.job_id
  ),
  pending_invitations as materialized (
    select distinct i.instructor_id as uid
    from public.job_invitations i
    join scoped_org_jobs j on j.id = i.job_id and j.status = 'open'
    where i.status = 'pending'
      and (p_job is null or i.job_id = p_job)
  ),
  -- Mirrors private.has_valid_vog (scope is applied in `instructors`).
  vog_users as materialized (
    select distinct d.user_id as uid
    from public.document_uploads d
    where d.doc_type = 'vog'
      and d.status = 'approved'
      and (d.expires_at is null or d.expires_at >= v_today)
  ),
  -- Mirrors public.instructor_public_stats.
  confirmed_jobs as materialized (
    select jc.instructor_id as uid, jc.job_id
    from public.job_confirmations jc
    where jc.confirmed_at is not null
    union
    select sc.instructor_id, sc.job_id
    from public.job_segment_confirmations sc
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
    where ca.side = 'instructor'
    group by ca.cancelled_by
  ),
  no_show_stats as materialized (
    select ns.instructor_id as uid, count(*) as n
    from public.no_show_records ns
    group by ns.instructor_id
  ),
  review_stats as materialized (
    select r.reviewee_id as uid,
           avg(r.rating)::numeric(3, 2) as avg_rating,
           count(*) as n
    from public.reviews r
    where r.released_at is not null
    group by r.reviewee_id
  ),
  sport_links as materialized (
    select s.user_id as uid, array_agg(s.sport_id order by s.sport_id) as ids
    from public.instructor_sports s
    group by s.user_id
  ),
  lesson_links as materialized (
    select t.user_id as uid, array_agg(t.lesson_type_id order by t.lesson_type_id) as ids
    from public.instructor_lesson_types t
    group by t.user_id
  ),
  qualification_links as materialized (
    select q.user_id as uid, array_agg(q.qualification_id) as ids
    from public.instructor_qualifications q
    group by q.user_id
  ),
  ruled_users as materialized (
    select distinct r.user_id as uid from public.availability_rules r
  ),
  -- Every in-scope instructor exactly once.
  base as materialized (
    select p.id as uid,
           p.full_name as name,
           p.avatar_url as avatar,
           p.onboarding_completed,
           coalesce(nullif(btrim(p.custom_city), ''), city.name) as city,
           city.lat, city.lng,
           ip.years_experience as years,
           ip.travel_distance_km as travel_km,
           ip.work_experience,
           ip.hourly_rate_cents,
           (vog.uid is not null) as vog,
           (pool.uid is not null) as is_pool,
           (worked.uid is not null) as is_worked,
           pa.job_id as pending_job,
           (pi.uid is not null) as is_invited,
           coalesce(rs.n, 0) as reviews,
           rs.avg_rating as rating,
           coalesce(js.completed, 0) as completed,
           case
             when coalesce(js.confirmed, 0) = 0 then null
             else round(
               greatest(0, least(100,
                 (js.completed::numeric / js.confirmed) * 55
                 + coalesce(rs.avg_rating / 5, 0.7) * 45
                 - coalesce(nss.n, 0) * 15
                 - coalesce(cs.n, 0) * 5
               )), 0)
           end as reliability,
           coalesce(sl.ids, '{}'::uuid[]) as sports,
           coalesce(ll.ids, '{}'::uuid[]) as lesson_types,
           coalesce(ql.ids, '{}'::uuid[]) as qualifications,
           (ru.uid is not null) as has_rules
    from public.profiles p
    join public.instructor_profiles ip on ip.user_id = p.id
    left join public.cities city on city.id = p.city_id
    left join vog_users vog on vog.uid = p.id
    left join pool on pool.uid = p.id
    left join worked on worked.uid = p.id
    left join pending_applications pa on pa.uid = p.id
    left join pending_invitations pi on pi.uid = p.id
    left join job_stats js on js.uid = p.id
    left join cancellation_stats cs on cs.uid = p.id
    left join no_show_stats nss on nss.uid = p.id
    left join review_stats rs on rs.uid = p.id
    left join sport_links sl on sl.uid = p.id
    left join lesson_links ll on ll.uid = p.id
    left join qualification_links ql on ql.uid = p.id
    left join ruled_users ru on ru.uid = p.id
    where p.role = 'instructor'
      and p.demo_session_id is not distinct from v_demo_session
  ),
  universe as materialized (
    select b.*
    from base b
    where b.vog or b.is_pool or b.is_worked or b.pending_job is not null or b.is_invited
  ),
  -- Mirrors public.instructor_has_schedule_conflict(user, job, start, end)
  -- for every open target job.
  busy as materialized (
    select jc.instructor_id as uid, tj.id as job_id
    from target_jobs tj
    join public.jobs other
      on other.starts_on = tj.starts_on
     and other.id <> tj.id
     and other.status = 'confirmed'
     and other.start_time < tj.end_time
     and other.end_time > tj.start_time
    join public.job_confirmations jc
      on jc.job_id = other.id and jc.confirmed_at is not null
    union
    select sc.instructor_id, tj.id
    from target_jobs tj
    join public.job_segment_confirmations sc
      on sc.job_id <> tj.id and sc.confirmed_at is not null and sc.cancelled_at is null
    join public.job_segments seg
      on seg.id = sc.segment_id
     and seg.start_time < tj.end_time
     and seg.end_time > tj.start_time
    join public.jobs other
      on other.id = sc.job_id and other.starts_on = tj.starts_on
  ),
  -- Every candidate against every open target job.
  job_fit as materialized (
    select u.uid, tj.id as job_id, tj.starts_on,
           (
             tj.sport_id = any (u.sports)
             and (
               tj.lesson_type_id is null
               or cardinality(u.lesson_types) = 0
               or tj.lesson_type_id = any (u.lesson_types)
             )
             and tj.requirements <@ u.qualifications
           ) as eligible,
           (tj.lesson_type_id is not null and tj.lesson_type_id = any (u.lesson_types)) as has_lesson,
           cardinality(tj.requirements) as requirement_count,
           case
             when u.lat is null or u.lng is null or tj.lat is null or tj.lng is null then null
             else round(public.distance_km(u.lat, u.lng, tj.lat, tj.lng)::numeric, 1)
           end as km,
           case
             when e.is_available is false then 'unavailable'
             when b.uid is not null then 'unavailable'
             when e.is_available is true then 'available'
             when u.has_rules and exists (
               select 1 from public.availability_rules r
               where r.user_id = u.uid
                 and r.weekday = tj.weekday
                 and r.start_time <= tj.start_time
                 and r.end_time >= tj.end_time
             ) then 'available'
             when u.has_rules then 'unavailable'
             else 'unknown'
           end as availability
    from universe u
    cross join target_jobs tj
    left join public.availability_exceptions e
      on e.user_id = u.uid and e.on_date = tj.starts_on
    left join busy b on b.uid = u.uid and b.job_id = tj.id
  ),
  -- Pre-existing hard criteria (sport, lesson type when the instructor lists
  -- any, required qualifications, travel radius when the distance is known,
  -- not unavailable) and the pre-existing score. Unknown distance and
  -- availability score neutrally; instructors without reviews get a fixed
  -- neutral review component instead of zero.
  best as materialized (
    select distinct on (f.uid) f.uid, f.job_id, f.availability,
           round(
             25
             + case when f.has_lesson then 15 else 8 end
             + case when f.requirement_count > 0 then 15 else 8 end
             + case
                 when f.km is null then 6
                 else greatest(0, 15 - (f.km / u.travel_km) * 15)
               end
             + least(u.years, 10)
             + (case when u.onboarding_completed then 4 else 0 end)
             + (case when u.avatar is not null then 2 else 0 end)
             + (case when char_length(btrim(u.work_experience)) >= 40 then 2 else 0 end)
             + (case when u.hourly_rate_cents is not null then 2 else 0 end)
             + case when f.availability = 'available' then 8 else 4 end
             + case
                 when u.reviews = 0 then 8
                 else least(10, (u.rating / 5) * 10)
               end
           )::integer as score
    from job_fit f
    join universe u on u.uid = f.uid
    where f.eligible
      and (f.km is null or f.km <= u.travel_km)
      and f.availability <> 'unavailable'
    order by f.uid, score desc, f.starts_on, f.job_id
  ),
  evaluated as materialized (
    select u.*,
           dist.km as distance,
           best.job_id as best_job,
           best.score as best_score,
           case when p_job is not null then selected.availability
                else best.availability end as availability_status,
           coalesce(p_job, best.job_id) as action_job
    from universe u
    left join lateral (
      select min(round(public.distance_km(u.lat, u.lng, rp.lat, rp.lng)::numeric, 1)) as km
      from reference_points rp
      where u.lat is not null and u.lng is not null
    ) dist on true
    left join best on best.uid = u.uid
    left join job_fit selected
      on p_job is not null and selected.uid = u.uid and selected.job_id = p_job
  ),
  filtered as (
    select s.*
    from evaluated s
    where (v_pattern is null or s.name ilike v_pattern)
      and (p_sport is null or p_sport = any (s.sports))
      and (p_lesson_type is null or p_lesson_type = any (s.lesson_types))
      and (p_availability is null or s.availability_status = p_availability)
      and (
        p_min_rating is null
        or (s.reviews > 0 and s.rating >= p_min_rating)
        or (p_include_unrated and s.reviews = 0)
      )
      and (p_min_experience is null or s.years >= p_min_experience)
      and (p_max_distance is null or (s.distance is not null and s.distance <= p_max_distance))
      and (
        p_relation is null
        or (p_relation = 'pool' and s.is_pool)
        or (p_relation = 'worked' and s.is_worked)
        or (p_relation = 'applied' and s.pending_job is not null)
        or (p_relation = 'invited' and s.is_invited)
      )
      and (
        p_min_reliability is null
        or s.reliability >= p_min_reliability
        or (p_include_unrated and s.reliability is null)
      )
      and (not coalesce(p_only_matching, false) or s.best_job is not null)
  ),
  -- Deterministic total order: the chosen key (unknown values last, never as
  -- zero), then name, then id as the unique tie-breaker for stable paging.
  ranked as (
    select f.*,
           row_number() over (
             order by
               case when v_sort = 'match' then f.best_score end desc nulls last,
               case when v_sort = 'match' then (f.reviews = 0) end desc,
               case when v_sort = 'rating' then f.rating end desc nulls last,
               case when v_sort = 'rating' then f.reviews end desc,
               case when v_sort = 'reliability' then f.reliability end desc nulls last,
               case when v_sort = 'experience' then f.years end desc,
               case when v_sort = 'distance' then f.distance end asc nulls last,
               lower(f.name) asc,
               f.uid asc
           ) as rank_position,
           count(*) over () as total
    from filtered f
  ),
  paged as (
    select r.*,
           least(v_offset, greatest(((r.total - 1) / v_limit) * v_limit, 0))::integer
             as effective_offset
    from ranked r
  )
  select pg.uid, pg.name, pg.avatar, pg.city, pg.years,
         pg.sports, pg.lesson_types, pg.vog,
         pg.rating, pg.reviews::bigint, pg.completed::bigint, pg.reliability,
         pg.is_pool, pg.is_worked, pg.pending_job, pg.is_invited,
         pg.action_job,
         exists (
           select 1 from public.job_applications a
           where a.job_id = pg.action_job and a.instructor_id = pg.uid
         ),
         exists (
           select 1 from public.job_invitations i
           where i.job_id = pg.action_job and i.instructor_id = pg.uid
         ),
         pg.best_job, pg.best_score, pg.availability_status, pg.distance,
         pg.total::bigint, pg.effective_offset
  from paged pg
  where pg.rank_position > pg.effective_offset
    and pg.rank_position <= pg.effective_offset + v_limit
  order by pg.rank_position;
end;
$$;

revoke all on function public.search_organization_candidates(
  uuid, uuid, uuid, text, uuid, uuid, text, numeric, integer, integer, text,
  integer, boolean, boolean, text, integer, integer
) from public, anon;
grant execute on function public.search_organization_candidates(
  uuid, uuid, uuid, text, uuid, uuid, text, numeric, integer, integer, text,
  integer, boolean, boolean, text, integer, integer
) to authenticated;
