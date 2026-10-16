-- Direct table writes may never manufacture an invitation or upgrade its role.
-- Existing rows and legitimate owner/admin management remain unchanged.
create function private.can_initialize_organization_owner(p_organization uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organizations o
    where o.id = p_organization
      and o.created_by = (select auth.uid())
      and public.demo_scope_matches(o.demo_session_id)
      and not exists (
        select 1 from public.organization_members m where m.organization_id = o.id
      )
  );
$$;

revoke all on function private.can_initialize_organization_owner(uuid) from public, anon;
grant execute on function private.can_initialize_organization_owner(uuid) to authenticated;

alter policy "leden toevoegen" on public.organization_members
  with check (
    private.is_org_owner(organization_id)
    or private.is_admin()
    or (
      user_id = (select auth.uid())
      and member_role = 'owner'
      and state = 'active'
      and private.can_initialize_organization_owner(organization_id)
    )
  );

alter policy "leden bijwerken" on public.organization_members
  using (private.is_org_owner(organization_id) or private.is_admin())
  with check (private.is_org_owner(organization_id) or private.is_admin());

-- Accept exactly one existing invitation. The client cannot supply an
-- organization, email, membership role or onboarding state to write.
create function public.accept_organization_invitation(p_invitation uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_invitation public.organization_members;
begin
  if v_user is null then
    raise exception 'Niet ingelogd.' using errcode = '42501';
  end if;

  select lower(u.email) into v_email from auth.users u
    where u.id = v_user and u.email_confirmed_at is not null;
  if v_email is null then
    raise exception 'Bevestig eerst je e-mailadres.' using errcode = '42501';
  end if;

  select m.* into v_invitation
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where m.id = p_invitation
      and public.demo_scope_matches(o.demo_session_id)
    for update of m;

  if not found then
    raise exception 'Deze uitnodiging is niet beschikbaar.' using errcode = '42501';
  end if;
  if v_invitation.state = 'active' and v_invitation.user_id = v_user then
    return;
  end if;
  if v_invitation.state <> 'invited'
    or v_invitation.user_id is not null
    or lower(v_invitation.invited_email) is distinct from v_email then
    raise exception 'Deze uitnodiging is niet beschikbaar.' using errcode = '42501';
  end if;

  update public.organization_members set user_id = v_user, state = 'active'
    where id = p_invitation;
  update public.profiles set onboarding_completed = true where id = v_user;
end;
$$;

revoke all on function public.accept_organization_invitation(uuid) from public, anon;
grant execute on function public.accept_organization_invitation(uuid) to authenticated;
