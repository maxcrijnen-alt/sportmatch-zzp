import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  BadgeCheck,
  Building2,
  CalendarPlus,
  CheckCircle2,
  Dumbbell,
  MapPin,
  ShieldCheck,
} from "lucide-react";
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
import type { City, LessonType, Sport } from "@/types/database";

export const metadata: Metadata = {
  title: "Profiel afronden",
};

const organizationSteps = [
  {
    icon: Building2,
    title: "Organisatie vastleggen",
    text: "Vul de bedrijfsnaam, het type organisatie en het telefoonnummer van de contactpersoon in.",
  },
  {
    icon: MapPin,
    title: "Eerste vestiging toevoegen",
    text: "Leg de plaats en adresgegevens vast. Extra vestigingen kun je later toevoegen.",
  },
  {
    icon: CalendarPlus,
    title: "Eerste opdracht plaatsen",
    text: "Na onboarding kun je direct een invaldienst, reeks lessen of vacature plaatsen.",
  },
];

const instructorSteps = [
  {
    icon: Dumbbell,
    title: "Profiel compleet maken",
    text: "Vul je woonplaats, reisafstand, tarief, ervaring en specialisaties in voor betere matches.",
  },
  {
    icon: ShieldCheck,
    title: "Documenten voorbereiden",
    text: "Na onboarding kun je diploma's, VOG, EHBO/BHV en verzekering toevoegen voor badges.",
  },
  {
    icon: BadgeCheck,
    title: "Opdrachten vinden",
    text: "Daarna zie je passende opdrachten en kun je reageren of een tegenvoorstel doen.",
  },
];

const organizationValueChecklist = [
  "Minimaal nodig: organisatiegegevens, contactpersoon en eerste vestiging.",
  "Daarna: eerste opdracht plaatsen met sport, datum, tijd, locatie en vergoeding.",
  "Meer vertrouwen: extra vestigingen en duidelijke contactafspraken later aanvullen.",
];

const instructorValueChecklist = [
  "Minimaal nodig: woonplaats, reisafstand, tarief en specialisaties.",
  "Daarna: passende opdrachten bekijken en reageren op opdrachten die echt kloppen.",
  "Meer vertrouwen: diploma's, VOG, EHBO/BHV en verzekering later toevoegen.",
];

export default async function OnboardingPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile || !supabase) {
    redirect("/login");
  }

  if (profile.onboarding_completed) {
    redirect("/dashboard");
  }

  const [
    { data: cities },
    { data: sports },
    { data: lessonTypes },
    { data: pendingInvites },
  ] =
    await Promise.all([
      supabase.from("cities").select("*").order("name"),
      supabase.from("sports").select("*").eq("is_active", true).order("name"),
      supabase
        .from("lesson_types")
        .select("*")
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("organization_members")
        .select("id, member_role, organization:organizations (name)")
        .eq("state", "invited")
        .ilike("invited_email", profile.email),
    ]);

  const isOrganization = profile.role === "organization";
  const steps = isOrganization ? organizationSteps : instructorSteps;
  const valueChecklist = isOrganization
    ? organizationValueChecklist
    : instructorValueChecklist;
  const invites =
    (pendingInvites as unknown as {
      id: string;
      member_role: string;
      organization: { name: string } | null;
    }[]) ?? [];

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5 px-4 py-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
      <aside className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-primary">
            Stap 2 van 2: profiel afronden
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            {isOrganization
              ? "Richt je sportschool klaar voor je eerste opdracht."
              : "Maak je instructeursprofiel klaar voor passende opdrachten."}
          </h1>
          <p className="text-muted-foreground">
            {isOrganization
              ? "Vul alleen in wat nodig is om straks snel een concrete opdracht te plaatsen en reacties goed te vergelijken."
              : "Vul de gegevens in die bepalen welke opdrachten je ziet en hoe sportscholen jouw reactie beoordelen."}
          </p>
        </div>

        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="font-medium">
            {isOrganization
              ? "Wat moet nu echt af?"
              : "Wat maakt je direct vindbaar?"}
          </p>
          <div className="mt-2 space-y-1.5">
            {valueChecklist.map((item) => (
              <p className="flex gap-2 text-sm leading-6 text-muted-foreground" key={item}>
                <CheckCircle2 className="mt-1 h-3.5 w-3.5 shrink-0 text-primary" />
                <span>{item}</span>
              </p>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card px-3">
          {steps.map((step) => {
            const Icon = step.icon;

            return (
              <div
                className="border-t border-border py-3 first:border-t-0"
                key={step.title}
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-primary/10 p-1.5 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="font-semibold">{step.title}</h2>
                    <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
                      {step.text}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="flex gap-2 text-sm font-medium">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            Je kunt later alles aanpassen
          </p>
          <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
            Deze onboarding zet alleen de basis goed. Details zoals extra
            vestigingen, documenten en beschikbaarheid kun je daarna
            rustig aanvullen vanuit je dashboard.
          </p>
        </div>
      </aside>

      <div className="space-y-4">
        {invites.length > 0 ? (
          <Card className="border-primary">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Je bent uitgenodigd</CardTitle>
              <CardDescription>
                Sluit je aan bij een bestaande organisatie in plaats van een
                nieuwe aan te maken.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-0 pt-0">
              {invites.map((invite) => (
                <form
                  action={acceptOrgInviteAction.bind(null, invite.id)}
                  className="flex items-center justify-between gap-3 border-t border-border py-3 first:border-t-0 first:pt-0"
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
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {isOrganization
                ? "Richt je organisatie in"
                : "Maak je instructeursprofiel af"}
            </CardTitle>
            <CardDescription>
              {isOrganization
                ? "Na opslaan kom je op je dashboard en kun je direct je eerste opdracht plaatsen."
                : "Na opslaan kom je op je dashboard en kun je passende opdrachten openen."}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {isOrganization ? (
              <OrganizationOnboardingForm cities={(cities as City[]) ?? []} />
            ) : (
              <InstructorOnboardingForm
                cities={(cities as City[]) ?? []}
                lessonTypes={(lessonTypes as LessonType[]) ?? []}
                sports={(sports as Sport[]) ?? []}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
