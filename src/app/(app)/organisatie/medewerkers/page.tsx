import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { InviteMemberForm } from "@/components/org/org-forms";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionProfile } from "@/lib/auth/session";
import { orgMemberRoleLabels } from "@/lib/labels";
import { removeMemberAction } from "@/lib/org/actions";
import { getOrgContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
import type { OrganizationMember } from "@/types/database";

export const metadata: Metadata = {
  title: "Medewerkers",
};

export default async function MedewerkersPage() {
  const profile = await getSessionProfile();
  const orgContext = await getOrgContext();
  const supabase = await createClient();

  if (!profile || !supabase) {
    redirect("/login");
  }

  if (!orgContext) {
    redirect("/dashboard");
  }

  const { data: membersData } = await supabase
    .from("organization_members")
    .select("*")
    .eq("organization_id", orgContext.organization.id)
    .neq("state", "removed")
    .order("created_at");

  const members = (membersData as OrganizationMember[] | null) ?? [];

  const userIds = members
    .map((member) => member.user_id)
    .filter((id): id is string => Boolean(id));

  const namesById = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: memberProfiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    for (const row of memberProfiles ?? []) {
      namesById.set(row.id as string, row.full_name as string);
    }
  }

  const isOwner = orgContext.memberRole === "owner";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Medewerkers</h1>
        <p className="text-sm text-muted-foreground">
          Elke medewerker logt in met een eigen account.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Team van {orgContext.organization.name}</CardTitle>
          <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            {members.length}
          </span>
        </CardHeader>
        <CardContent className="space-y-0 pt-0">
          {members.map((member) => {
            const name = member.user_id
              ? (namesById.get(member.user_id) ?? "Onbekend")
              : member.invited_email;

            return (
              <div
                className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-3 first:border-t-0 first:pt-0"
                key={member.id}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={name} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{name}</p>
                    <p className="text-xs text-muted-foreground">
                      {orgMemberRoleLabels[member.member_role]}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {member.state === "invited" ? (
                    <Badge variant="secondary">Uitnodiging verstuurd</Badge>
                  ) : null}
                  {isOwner && member.user_id !== profile.id ? (
                    <form action={removeMemberAction.bind(null, member.id)}>
                      <Button size="sm" type="submit" variant="ghost">
                        Verwijderen
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {isOwner ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Medewerker uitnodigen</CardTitle>
            <CardDescription>
              Nodig een collega uit met het e-mailadres waarmee die zich registreert.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <InviteMemberForm />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
