-- Review attributes: up to three fixed, side-specific traits per review.
--
-- Additive only. Existing reviews keep their rating and comment and receive an
-- empty attribute list. The values are stable internal identifiers; the app
-- owns the Dutch labels (src/lib/reviews/attributes.ts).
--
-- `side` is the side of the reviewer:
--   organization -> a gym rates an instructor
--   instructor   -> an instructor rates a gym
--
-- Visibility needs no new policy: the attributes live on the review row, so
-- the existing "reviews zichtbaar binnen scope" policy releases them together
-- with the rating, and keeps them hidden while the review is double blind.

alter table public.reviews
  add column attributes text[] not null default '{}'::text[];

-- Database-level validation for every write route (RPC, service role, admin
-- update). Only built-in operators are used: a CHECK that calls a custom
-- function would require EXECUTE for every writing role.
--   * one-dimensional array starting at index 1 (or empty)
--   * at most three values, no NULLs
--   * every value belongs to the reviewer's side
--   * no duplicates (spelled out pairwise; safe because of the size limit)
alter table public.reviews
  add constraint reviews_attributes_valid check (
    cardinality(attributes) <= 3
    and (
      cardinality(attributes) = 0
      or (array_ndims(attributes) = 1 and array_lower(attributes, 1) = 1)
    )
    and attributes <@ (
      case side
        when 'organization' then array[
          'keeps_agreements',
          'communicates_clearly',
          'quality_lessons',
          'professional',
          'flexible'
        ]::text[]
        when 'instructor' then array[
          'clear_communication',
          'well_organized',
          'agreements_kept',
          'pleasant_collaboration',
          'good_facilities'
        ]::text[]
        else '{}'::text[]
      end
    )
    and (cardinality(attributes) < 2 or attributes[1] <> attributes[2])
    and (
      cardinality(attributes) < 3
      or (attributes[1] <> attributes[3] and attributes[2] <> attributes[3])
    )
  );

-- Replace the review RPC in place. The old four-argument signature is dropped
-- first so that no overload without attribute validation remains callable.
-- Existing callers keep working: p_attributes defaults to an empty list.
-- Authorization, reviewee resolution and the insert are unchanged apart from
-- the attributes.
drop function if exists public.submit_review(uuid, integer, text, uuid);
create function public.submit_review(
  p_job uuid,
  p_rating integer,
  p_comment text default '',
  p_reviewee uuid default null,
  p_attributes text[] default '{}'::text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_conf public.job_confirmations;
  v_side public.party_side;
  v_reviewee uuid;
  v_review uuid;
  v_input text[] := coalesce(p_attributes, '{}'::text[]);
  v_allowed text[];
  v_attributes text[];
begin
  select * into v_job from public.jobs where id = p_job;
  if v_job.id is null or v_job.status <> 'completed' then
    raise exception 'Alleen afgeronde opdrachten kunnen worden beoordeeld.';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Een beoordeling is 1 tot en met 5 sterren.';
  end if;
  select * into v_conf
  from public.job_confirmations
  where job_id = p_job and confirmed_at is not null;

  if v_conf.id is not null and v_conf.instructor_id = auth.uid() then
    v_side := 'instructor'; v_reviewee := v_job.created_by;
  elsif v_conf.id is not null and public.is_org_member(v_job.organization_id) then
    v_side := 'organization'; v_reviewee := v_conf.instructor_id;
  elsif exists (
    select 1 from public.job_segment_confirmations sc
    where sc.job_id = p_job
      and sc.instructor_id = auth.uid()
      and sc.confirmed_at is not null
      and sc.cancelled_at is null
  ) then
    v_side := 'instructor'; v_reviewee := v_job.created_by;
  elsif public.is_org_member(v_job.organization_id) then
    v_side := 'organization';
    if p_reviewee is not null and exists (
      select 1 from public.job_segment_confirmations sc
      where sc.job_id = p_job
        and sc.instructor_id = p_reviewee
        and sc.confirmed_at is not null
        and sc.cancelled_at is null
    ) then
      v_reviewee := p_reviewee;
    else
      select (array_agg(distinct sc.instructor_id))[1]
      into v_reviewee
      from public.job_segment_confirmations sc
      where sc.job_id = p_job
        and sc.confirmed_at is not null
        and sc.cancelled_at is null
      having count(distinct sc.instructor_id) = 1;
    end if;
    if v_reviewee is null then
      raise exception 'Kies welke instructeur je beoordeelt.';
    end if;
  else
    raise exception 'Alleen betrokkenen kunnen beoordelen.';
  end if;

  -- The allowed set follows from the side derived above, never from input.
  -- Keep this list identical to the reviews_attributes_valid constraint.
  v_allowed := case v_side
    when 'organization' then array[
      'keeps_agreements',
      'communicates_clearly',
      'quality_lessons',
      'professional',
      'flexible'
    ]::text[]
    else array[
      'clear_communication',
      'well_organized',
      'agreements_kept',
      'pleasant_collaboration',
      'good_facilities'
    ]::text[]
  end;

  if coalesce(array_ndims(v_input), 1) <> 1 then
    raise exception 'De gekozen kenmerken zijn ongeldig.';
  end if;
  if cardinality(v_input) > 3 then
    raise exception 'Kies maximaal drie kenmerken.';
  end if;
  if array_position(v_input, null) is not null then
    raise exception 'De gekozen kenmerken zijn ongeldig.';
  end if;
  if (select count(distinct value) from unnest(v_input) as value)
     <> cardinality(v_input) then
    raise exception 'Kies ieder kenmerk maar één keer.';
  end if;
  if not (v_input <@ v_allowed) then
    raise exception 'Een gekozen kenmerk hoort niet bij deze beoordeling.';
  end if;

  -- Store in the fixed definition order, so every page shows the same order.
  select coalesce(array_agg(code order by ord), '{}'::text[])
  into v_attributes
  from unnest(v_allowed) with ordinality as allowed(code, ord)
  where code = any (v_input);

  insert into public.reviews (
    job_id, reviewer_id, reviewee_id, side, rating, comment, attributes
  )
  values (
    p_job, auth.uid(), v_reviewee, v_side, p_rating,
    left(coalesce(p_comment, ''), 2000), v_attributes
  )
  returning id into v_review;
  return v_review;
end;
$$;

revoke all on function public.submit_review(uuid, integer, text, uuid, text[])
  from public, anon;
grant execute on function public.submit_review(uuid, integer, text, uuid, text[])
  to authenticated;
