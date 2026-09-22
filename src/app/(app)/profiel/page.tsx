import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Eye } from "lucide-react";
import { AvatarUpload } from "@/components/profile/avatar-upload";
import { InstructorDetailsForm } from "@/components/profile/instructor-details-form";
import { ProfileForm } from "@/components/profile/profile-form";
import { Button } from "@/components/ui/button";
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
  LessonType,
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
    const [
      detailsResult,
      sportsResult,
      lessonTypesResult,
      statusesResult,
      instructorSportsResult,
      instructorLessonTypesResult,
    ] = await Promise.all([
        supabase
          .from("instructor_profiles")
          .select("*")
          .eq("user_id", profile.id)
          .maybeSingle(),
        supabase.from("sports").select("*").eq("is_active", true).order("name"),
        supabase
          .from("lesson_types")
          .select("*")
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("instructor_statuses")
          .select("status")
          .eq("user_id", profile.id),
        supabase
          .from("instructor_sports")
          .select("sport_id")
          .eq("user_id", profile.id),
        supabase
          .from("instructor_lesson_types")
          .select("lesson_type_id")
          .eq("user_id", profile.id),
      ]);

    const details = detailsResult.data as InstructorProfile | null;

    if (details) {
      instructorSection = (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Instructeursgegevens</CardTitle>
            <CardDescription>
              Tarief, reisafstand, statussen en specialisaties.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <InstructorDetailsForm
              details={details}
              lessonTypes={(lessonTypesResult.data as LessonType[]) ?? []}
              selectedLessonTypeIds={
                instructorLessonTypesResult.data?.map(
                  (row) => row.lesson_type_id as string,
                ) ?? []
              }
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
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Profiel</h1>
          <p className="text-sm text-muted-foreground">
            Beheer je gegevens en verbeter wat anderen van je profiel zien.
          </p>
        </div>
        {profile.role === "instructor" ? (
          <div className="flex flex-wrap gap-2">
            <Link href={`/organisatie/kandidaten/${profile.id}`}>
              <Button size="sm">
                <Eye className="h-4 w-4" />
                Bekijk zoals sportscholen
              </Button>
            </Link>
            <Link href="/opdrachten">
              <Button size="sm" variant="outline">
                Passende opdrachten
              </Button>
            </Link>
          </div>
        ) : null}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Persoonlijke gegevens</CardTitle>
          <CardDescription>
            Contactgegevens worden pas gedeeld na een bevestigde opdracht.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
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
