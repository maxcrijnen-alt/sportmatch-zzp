import { cache } from "react";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type {
  Organization,
  OrganizationLocation,
  OrgMemberRole,
} from "@/types/database";

export interface OrgContext {
  organization: Organization;
  memberRole: OrgMemberRole;
  locations: OrganizationLocation[];
}

/**
 * Organisatiecontext van de ingelogde gebruiker (eerste actieve lidmaatschap).
 * Null voor instructeurs, admins zonder lidmaatschap en niet-ingelogden.
 */
export const getOrgContext = cache(async (): Promise<OrgContext | null> => {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile || !supabase) {
    return null;
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("member_role, organization:organizations(*)")
    .eq("user_id", profile.id)
    .eq("state", "active")
    .limit(1)
    .maybeSingle();

  if (!membership?.organization) {
    return null;
  }

  const organization = membership.organization as unknown as Organization;

  const { data: locations } = await supabase
    .from("organization_locations")
    .select("*")
    .eq("organization_id", organization.id)
    .order("created_at");

  return {
    organization,
    memberRole: membership.member_role as OrgMemberRole,
    locations: (locations as OrganizationLocation[] | null) ?? [],
  };
});
