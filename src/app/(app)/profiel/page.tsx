import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Dumbbell, Eye, UserRound } from "lucide-react";
import { AvatarUpload } from "@/components/profile/avatar-upload";
import { InstructorDetailsForm } from "@/components/profile/instructor-details-form";
import { ProfileForm } from "@/components/profile/profile-form";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Page, PageHeader } from "@/components/ui/page";
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
        <ProfileSection
          description="Tarief, reisafstand, statussen en specialisaties."
          icon={Dumbbell}
          title="Instructeursgegevens"
        >
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
        </ProfileSection>
      );
    }
  }

  return (
    <Page width="medium">
      <PageHeader
        actions={
          profile.role === "instructor" ? (
            <Link href="/opdrachten">
              <Button className="w-full sm:w-auto" variant="outline">
                Passende opdrachten
              </Button>
            </Link>
          ) : null
        }
        title="Profiel"
      />

      {profile.role === "instructor" ? (
        <section
          aria-label="Publieke profielweergave"
          className="flex flex-col gap-4 rounded-xl border border-primary/20 bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-5"
        >
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={profile.full_name} size="lg" src={profile.avatar_url} />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                Publieke profielweergave
              </p>
              <p className="truncate text-base font-semibold">{profile.full_name}</p>
            </div>
          </div>
          <Link href={`/organisatie/kandidaten/${profile.id}`}>
            <Button className="w-full sm:w-auto">
              <Eye className="h-4 w-4" />
              Bekijk zoals sportscholen
            </Button>
          </Link>
        </section>
      ) : null}

      <ProfileSection
        description="Contactgegevens worden pas gedeeld na een bevestigde opdracht."
        icon={UserRound}
        title="Persoonlijke gegevens"
      >
        <AvatarUpload
          avatarUrl={profile.avatar_url}
          name={profile.full_name}
          userId={profile.id}
        />
        <div className="h-px bg-border" />
        <ProfileForm cities={(cities as City[]) ?? []} profile={profile} />
      </ProfileSection>

      {instructorSection}
    </Page>
  );
}

function ProfileSection({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: typeof UserRound;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start gap-3 border-b border-border">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 space-y-0.5">
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">{children}</CardContent>
    </Card>
  );
}
