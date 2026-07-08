import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
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
  Sport,
} from "@/types/database";

export const metadata: Metadata = {
  title: "Profiel",
};

const instructorProfileTips = [
  "Woonplaats en reisafstand bepalen welke opdrachten standaard zichtbaar zijn.",
  "Tarief en ervaring helpen sportscholen sneller beoordelen of je past.",
  "Specialisaties en statussen zorgen dat de juiste lessen en invaldiensten bovenaan komen.",
];

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
          Beheer je gegevens en verbeter wat anderen van je profiel zien.
        </p>
      </div>

      {profile.role === "instructor" ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-xl">Maak je profiel matchbaar</CardTitle>
            <CardDescription>
              Een compleet profiel zorgt dat je sneller passende opdrachten ziet
              en dat sportscholen jouw reactie beter kunnen beoordelen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-3">
              {instructorProfileTips.map((tip) => (
                <p
                  className="flex gap-2 rounded-md border border-border bg-background p-3 text-sm leading-6"
                  key={tip}
                >
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                  <span>{tip}</span>
                </p>
              ))}
            </div>
            <Link href="/opdrachten">
              <Button variant="outline">Bekijk passende opdrachten</Button>
            </Link>
          </CardContent>
        </Card>
      ) : null}

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
