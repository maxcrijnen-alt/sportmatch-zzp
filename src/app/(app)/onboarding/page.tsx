import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { InstructorOnboardingForm } from "@/components/onboarding/instructor-onboarding-form";
import { OrganizationOnboardingForm } from "@/components/onboarding/organization-onboarding-form";
import { Button } from "@/components/ui/button";
import { acceptOrgInviteAction } from "@/lib/org/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { City, Sport } from "@/types/database";

export const metadata: Metadata = {
  title: "Profiel afronden",
};

export default async function OnboardingPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile || !supabase) {
    redirect("/login");
  }

  if (profile.onboarding_completed) {
    redirect("/dashboard");
  }

  const [{ data: cities }, { data: sports }, { data: pendingInvites }] =
    await Promise.all([
      supabase.from("cities").select("*").order("name"),
      supabase.from("sports").select("*").eq("is_active", true).order("name"),
      supabase
        .from("organization_members")
        .select("id, member_role, organization:organizations (name)")
        .eq("state", "invited")
        .ilike("invited_email", profile.email),
    ]);

  const isOrganization = profile.role === "organization";
  const invites =
    (pendingInvites as unknown as {
      id: string;
      member_role: string;
      organization: { name: string } | null;
    }[]) ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      {invites.length > 0 ? (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-lg">Je bent uitgenodigd</CardTitle>
            <CardDescription>
              Sluit je aan bij een bestaande organisatie in plaats van een
              nieuwe aan te maken.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {invites.map((invite) => (
              <form
                action={acceptOrgInviteAction.bind(null, invite.id)}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                key={invite.id}
              >
                <p className="text-sm font-medium">
                  {invite.organization?.name ?? "Organisatie"}
                </p>
                <Button size="sm" type="submit">
                  Uitnodiging accepteren
                </Button>
              </form>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            {isOrganization
              ? "Richt je organisatie in"
              : "Maak je instructeursprofiel af"}
          </CardTitle>
          <CardDescription>
            {isOrganization
              ? "Vul de gegevens van je organisatie en je eerste vestiging in. Daarna kun je direct opdrachten plaatsen."
              : "Met een compleet profiel krijg je betere matches en meer reacties van organisaties."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isOrganization ? (
            <OrganizationOnboardingForm cities={(cities as City[]) ?? []} />
          ) : (
            <InstructorOnboardingForm
              cities={(cities as City[]) ?? []}
              sports={(sports as Sport[]) ?? []}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
