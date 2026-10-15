-- No subscription rows or existing rights are changed by this migration.
-- A mock payment is only meaningful inside the caller's live demo session.
create or replace function public.mock_activate_subscription(p_subscription uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
  v_demo uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Geen toegang tot dit abonnement.';
  end if;
  select p.demo_session_id into v_demo from public.profiles p where p.id = auth.uid();
  if v_demo is null or not exists (
    select 1 from public.demo_sessions s where s.id = v_demo and s.expires_at > now()
  ) then
    raise exception using errcode = '42501', message = 'Mockbetalingen zijn alleen beschikbaar in een actieve demo.';
  end if;

  select * into v_sub from public.subscriptions where id = p_subscription for update;
  if v_sub.id is null or not (
    coalesce(v_sub.instructor_id = auth.uid(), false)
    or exists (
      select 1 from public.organization_locations l
      join public.organizations o on o.id = l.organization_id
      where l.id = v_sub.location_id and o.demo_session_id = v_demo
        and public.is_org_owner(o.id)
    )
  ) then
    raise exception using errcode = '42501', message = 'Geen toegang tot dit abonnement.';
  end if;

  update public.subscriptions
  set status = 'active', current_period_end = now() + interval '1 month',
      grace_until = null, cancelled_at = null
  where id = p_subscription;
  insert into public.billing_events (subscription_id, event_type, payload, created_by)
  values (p_subscription, 'mock_payment_succeeded',
    jsonb_build_object('note', 'Mockbetaling; geen echte transactie.', 'demo_session_id', v_demo), auth.uid());
end;
$$;
revoke all on function public.mock_activate_subscription(uuid) from public, anon;
grant execute on function public.mock_activate_subscription(uuid) to authenticated;

-- Fail closed for nullable instructor_id on location subscriptions. Keep normal
-- owner cancellations and the existing administrator support path available.
create or replace function public.cancel_subscription(p_subscription uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Geen toegang tot dit abonnement.';
  end if;
  select * into v_sub from public.subscriptions where id = p_subscription for update;
  if v_sub.id is null or not (
    coalesce(v_sub.instructor_id = auth.uid(), false)
    or exists (
      select 1 from public.organization_locations l
      where l.id = v_sub.location_id and public.is_org_owner(l.organization_id)
        and private.organization_in_demo_scope(l.organization_id)
    )
    or public.is_admin()
  ) then
    raise exception using errcode = '42501', message = 'Geen toegang tot dit abonnement.';
  end if;
  update public.subscriptions set status = 'cancelled', cancelled_at = now()
  where id = p_subscription;
  insert into public.billing_events (subscription_id, event_type, payload, created_by)
  values (p_subscription, 'subscription_cancelled', '{}'::jsonb, auth.uid());
end;
$$;
revoke all on function public.cancel_subscription(uuid) from public, anon;
grant execute on function public.cancel_subscription(uuid) to authenticated;
