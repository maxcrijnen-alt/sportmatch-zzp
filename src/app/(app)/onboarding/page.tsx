import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { InstructorOnboardingForm } from "@/components/onboarding/instructor-onboarding-form";
import { OrganizationOnboardingForm } from "@/components/onboarding/organization-onboarding-form";
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

  const [{ data: cities }, { data: sports }] = await Promise.all([
    supabase.from("cities").select("*").order("name"),
    supabase.from("sports").select("*").eq("is_active", true).order("name"),
  ]);

  const isOrganization = profile.role === "organization";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
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
