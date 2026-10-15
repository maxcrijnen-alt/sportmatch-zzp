import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CreateJobForm,
  type JobFormDefaults,
} from "@/components/jobs/create-job-form";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionProfile } from "@/lib/auth/session";
import { subscriptionGrantsAccess } from "@/lib/billing/access";
import { getOrgContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
import type {
  Job,
  JobTemplate,
  LessonType,
  Qualification,
  Sport,
  Subscription,
} from "@/types/database";

export const metadata: Metadata = {
  title: "Nieuwe opdracht",
};

export default async function NieuweOpdrachtPage({
  searchParams,
}: {
  searchParams: Promise<{ duplicate?: string; template?: string }>;
}) {
  const profile = await getSessionProfile();
  const orgContext = await getOrgContext();
  const supabase = await createClient();

  if (!profile || !supabase) {
    redirect("/login");
  }

  if (!orgContext) {
    redirect("/dashboard");
  }

  const locationIds = orgContext.locations.map((location) => location.id);

  const params = await searchParams;
  const [
    sportsResult,
    lessonTypesResult,
    qualificationsResult,
    subscriptionsResult,
    templatesResult,
  ] =
    await Promise.all([
      supabase.from("sports").select("*").eq("is_active", true).order("name"),
      supabase
        .from("lesson_types")
        .select("*")
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("qualifications")
        .select("*")
        .eq("is_active", true)
        .order("name"),
      locationIds.length > 0
        ? supabase.from("subscriptions").select("*").in("location_id", locationIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from("job_templates")
        .select("*")
        .eq("organization_id", orgContext.organization.id)
        .order("updated_at", { ascending: false }),
    ]);

  const subscriptions =
    (subscriptionsResult.data as Subscription[] | null) ?? [];
  const activeLocations = orgContext.locations.filter((location) =>
    subscriptionGrantsAccess(
      subscriptions.find((subscription) => subscription.location_id === location.id),
    ),
  );

  const templates = (templatesResult.data as JobTemplate[] | null) ?? [];
  let defaults: JobFormDefaults = {};

  if (params.template) {
    const template = templates.find((item) => item.id === params.template);
    if (template) {
      defaults = template.template_data as JobFormDefaults;
    }
  } else if (params.duplicate) {
    const [
      { data: source },
      { data: requirements },
      { data: segments },
      { data: recurrence },
    ] = await Promise.all([
      supabase
        .from("jobs")
        .select("*")
        .eq("id", params.duplicate)
        .eq("organization_id", orgContext.organization.id)
        .maybeSingle(),
      supabase
        .from("job_requirements")
        .select("qualification_id")
        .eq("job_id", params.duplicate),
      supabase
        .from("job_segments")
        .select("start_time, end_time, lesson_type_id, custom_lesson_type, level")
        .eq("job_id", params.duplicate)
        .order("position"),
      supabase
        .from("job_recurrence_rules")
        .select("interval_weeks, occurrence_count, ends_on")
        .eq("job_id", params.duplicate)
        .maybeSingle(),
    ]);
    const job = source as Job | null;
    if (job) {
      const normalizedPayType =
        job.pay_type === "fixed" || job.pay_hourly_rate_cents == null
          ? "fixed"
          : "hourly";
      defaults = {
        jobType: job.job_type,
        sportId: job.sport_id,
        lessonTypeId:
          job.lesson_type_id ?? (job.custom_lesson_type ? "custom" : undefined),
        customLessonType: job.custom_lesson_type ?? undefined,
        locationId: job.location_id,
        title: `${job.title} (kopie)`,
        description: job.description,
        startsOn: job.starts_on,
        startTime: job.start_time.slice(0, 5),
        endTime: job.end_time.slice(0, 5),
        recurrenceNote: job.recurrence_note,
        payType: normalizedPayType,
        payAmountEuro:
          job.pay_amount_cents == null ? undefined : job.pay_amount_cents / 100,
        payHourlyRateEuro:
          job.pay_hourly_rate_cents == null
            ? undefined
            : job.pay_hourly_rate_cents / 100,
        payIsNegotiable: job.pay_is_negotiable,
        requiredLevel: job.required_level,
        expectedParticipants: job.expected_participants ?? undefined,
        qualificationIds:
          requirements?.map((item) => item.qualification_id as string) ?? [],
        intervalWeeks: recurrence?.interval_weeks ?? undefined,
        occurrenceCount: recurrence?.occurrence_count ?? undefined,
        endsOn: recurrence?.ends_on ?? undefined,
        partialBlockAllowed: job.partial_block_allowed,
        segments:
          segments?.map((segment) => ({
            startTime: String(segment.start_time).slice(0, 5),
            endTime: String(segment.end_time).slice(0, 5),
            lessonTypeId: segment.lesson_type_id
              ? (segment.lesson_type_id as string)
              : "custom",
            customLessonType:
              (segment.custom_lesson_type as string | null) ?? undefined,
            level: (segment.level as string | null) ?? undefined,
          })) ?? [],
      };
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nieuwe opdracht</h1>
        <p className="text-sm text-muted-foreground">
          Plaats een opdracht of vacature voor {orgContext.organization.name}.
        </p>
      </div>

      {activeLocations.length === 0 ? (
        <Alert variant="warning">
          <AlertTitle>Geen vestiging met actieve toegang</AlertTitle>
          <AlertDescription>
            Om een opdracht te plaatsen heeft minimaal één vestiging een actieve
            proefperiode of een actief abonnement nodig. Bekijk je abonnementen
            op de abonnementspagina.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-3">
          {templates.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Start vanuit een sjabloon</CardTitle>
                <CardDescription>
                  De datum blijft leeg; les- en bloktijden uit het sjabloon kun je aanpassen.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 pt-0">
                {templates.map((template) => (
                  <Link href={`/organisatie/opdrachten/nieuw?template=${template.id}`} key={template.id}>
                    <Button size="sm" variant="outline">{template.name}</Button>
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : null}
          <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Opdrachtgegevens</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <CreateJobForm
              defaultContactName={profile.full_name}
              locations={activeLocations}
              lessonTypes={(lessonTypesResult.data as LessonType[]) ?? []}
              qualifications={
                (qualificationsResult.data as Qualification[]) ?? []
              }
              sports={(sportsResult.data as Sport[]) ?? []}
              defaults={defaults}
            />
          </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
