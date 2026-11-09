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
import { AcceptInviteForm } from "@/components/org/accept-invite-form";
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
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start lg:px-8 lg:py-10">
      <aside className="space-y-4 lg:sticky lg:top-24">
        <div className="space-y-2">
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <span className="flex gap-1" aria-hidden="true">
              <span className="h-1.5 w-5 rounded-full bg-primary" />
              <span className="h-1.5 w-5 rounded-full bg-primary" />
            </span>
            Stap 2 van 2: profiel afronden
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem] sm:leading-9">
            {isOrganization
              ? "Richt je sportschool klaar voor je eerste opdracht."
              : "Maak je instructeursprofiel klaar voor passende opdrachten."}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            {isOrganization
              ? "Vul alleen in wat nodig is om straks snel een concrete opdracht te plaatsen en reacties goed te vergelijken."
              : "Vul de gegevens in die bepalen welke opdrachten je ziet en hoe sportscholen jouw reactie beoordelen."}
          </p>
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary-soft p-4">
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

        <div className="overflow-hidden rounded-xl border border-border bg-card px-4 shadow-card">
          {steps.map((step) => {
            const Icon = step.icon;

            return (
              <div
                className="border-t border-border py-3 first:border-t-0"
                key={step.title}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">{step.title}</h2>
                    <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
                      {step.text}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="flex gap-2 px-1 text-sm text-muted-foreground">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          Je kunt later alles aanpassen
        </p>
      </aside>

      <div className="space-y-4">
        {invites.length > 0 ? (
          <Card className="border-primary/30 ring-1 ring-primary/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Je bent uitgenodigd</CardTitle>
              <CardDescription>
                Sluit je aan bij een bestaande organisatie in plaats van een
                nieuwe aan te maken.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-0 pt-0">
              {invites.map((invite) => (
                <AcceptInviteForm
                  key={invite.id}
                  memberId={invite.id}
                  organizationName={invite.organization?.name ?? "Organisatie"}
                />
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle>
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
          <CardContent className="pt-5">
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
