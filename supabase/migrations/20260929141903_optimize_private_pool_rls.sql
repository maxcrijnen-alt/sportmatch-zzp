-- Cache the request user ID once per statement in the three private pool
-- policies. All role, organization, and demo-scope checks remain unchanged.

alter policy "organisatie leest eigen private poule"
  on public.organization_instructor_connections
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'organization'
    )
    and private.is_org_member(organization_id)
    and private.organization_in_demo_scope(organization_id)
    and private.profile_in_demo_scope(instructor_id)
  );

alter policy "organisatie voegt toe aan eigen private poule"
  on public.organization_instructor_connections
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'organization'
    )
    and exists (
      select 1 from public.profiles p
      where p.id = instructor_id and p.role = 'instructor'
    )
    and private.is_org_member(organization_id)
    and private.organization_in_demo_scope(organization_id)
    and private.profile_in_demo_scope(instructor_id)
  );

alter policy "organisatie verwijdert uit eigen private poule"
  on public.organization_instructor_connections
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'organization'
    )
    and private.is_org_member(organization_id)
    and private.organization_in_demo_scope(organization_id)
    and private.profile_in_demo_scope(instructor_id)
  );
