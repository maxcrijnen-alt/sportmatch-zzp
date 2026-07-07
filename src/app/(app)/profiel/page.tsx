import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AvatarUpload } from "@/components/profile/avatar-upload";
import { InstructorDetailsForm } from "@/components/profile/instructor-details-form";
import { ProfileForm } from "@/components/profile/profile-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type {
  City,
  InstructorProfile,
  InstructorStatus,
  Sport,
} from "@/types/database";

export const metadata: Metadata = {
  title: "Profiel",
};

export default async function ProfielPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile || !supabase) {
    redirect("/login");
  }

  const { data: cities } = await supabase.from("cities").select("*").order("name");

  let instructorSection: React.ReactNode = null;

  if (profile.role === "instructor") {
    const [detailsResult, sportsResult, statusesResult, instructorSportsResult] =
      await Promise.all([
        supabase
          .from("instructor_profiles")
          .select("*")
          .eq("user_id", profile.id)
          .maybeSingle(),
        supabase.from("sports").select("*").eq("is_active", true).order("name"),
        supabase
          .from("instructor_statuses")
          .select("status")
          .eq("user_id", profile.id),
        supabase
          .from("instructor_sports")
          .select("sport_id")
          .eq("user_id", profile.id),
      ]);

    const details = detailsResult.data as InstructorProfile | null;

    if (details) {
      instructorSection = (
        <Card>
          <CardHeader>
            <CardTitle>Instructeursgegevens</CardTitle>
            <CardDescription>
              Tarief, reisafstand, statussen en specialisaties bepalen welke
              opdrachten je ziet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InstructorDetailsForm
              details={details}
              selectedSportIds={
                instructorSportsResult.data?.map((row) => row.sport_id as string) ??
                []
              }
              selectedStatuses={
                (statusesResult.data?.map((row) => row.status) ??
                  []) as InstructorStatus[]
              }
              sports={(sportsResult.data as Sport[]) ?? []}
            />
          </CardContent>
        </Card>
      );
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profiel</h1>
        <p className="text-sm text-muted-foreground">
          Beheer je persoonlijke gegevens.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Persoonlijke gegevens</CardTitle>
          <CardDescription>
            Telefoonnummer en e-mailadres worden pas met de andere partij
            gedeeld na een bevestigde opdracht.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <AvatarUpload
            avatarUrl={profile.avatar_url}
            name={profile.full_name}
            userId={profile.id}
          />
          <ProfileForm cities={(cities as City[]) ?? []} profile={profile} />
        </CardContent>
      </Card>

      {instructorSection}
    </div>
  );
}
