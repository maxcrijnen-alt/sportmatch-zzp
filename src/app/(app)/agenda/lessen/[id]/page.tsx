import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ArrowRight, CalendarDays, Check, Clock3, MapPin, UserRound } from "lucide-react";
import { LessonForm } from "@/components/agenda/lesson-form";
import { JobStatusIndicator } from "@/components/jobs/job-status-indicator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Page, PageHeader } from "@/components/ui/page";
import { getOrgContext } from "@/lib/org/context";
import { getScheduledLesson } from "@/lib/agenda/lessons";
import { createClient } from "@/lib/supabase/server";
import { deriveLessonState } from "@/lib/jobs/workflow";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const org = await getOrgContext();
  const client = await createClient();
  if (!org || !client) redirect("/agenda");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const lesson = await getScheduledLesson(org.organization.id, id);
  if (!lesson) notFound();
  const synthetic = lesson.source.provider === "synthetic";
  const changed =
    lesson.replacement &&
    lesson.replacement.lesson_revision !== lesson.revision;
  const { data: sports } = await client
    .from("sports")
    .select("id,name")
    .eq("is_active", true)
    .order("name");
  const lessonState = lesson.cancelled
    ? "cancelled"
    : lesson.replacement
      ? deriveLessonState(lesson.replacement.job.status, undefined)
      : lesson.needs_substitute
        ? "replacement_needed"
        : "scheduled";
  const showRoute = Boolean(lesson.needs_substitute || lesson.replacement);
  const routeSteps = [
    { label: "Les", done: true },
    { label: "Inval nodig", done: showRoute },
    { label: "Invalopdracht", done: Boolean(lesson.replacement) },
    {
      label: "Bevestigd",
      done: lessonState === "confirmed" || lessonState === "completed",
    },
  ];
  const currentStep = routeSteps.findIndex((step) => !step.done);
  const dateLabel = new Intl.DateTimeFormat("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${lesson.starts_on}T12:00:00Z`));
  return (
    <Page width="narrow">
      <PageHeader
        title={lesson.title}
        back={{ href: `/agenda?lesson=${id}`, label: "Agenda" }}
        meta={
          <>
            <JobStatusIndicator size="sm" state={lessonState} />
            {synthetic ? <Badge variant="muted">Voorbeeldrooster</Badge> : null}
          </>
        }
        actions={
          lesson.replacement ? (
            <Link
              className={buttonVariants()}
              href={`/organisatie/opdrachten/${lesson.replacement.job_id}`}
            >
              Invalopdracht bekijken
            </Link>
          ) : !synthetic && !lesson.cancelled ? (
            <Link
              className={buttonVariants({
                variant: lesson.needs_substitute ? "default" : "outline",
              })}
              href={`/organisatie/opdrachten/nieuw?lesson=${id}`}
            >
              Invalopdracht aanmaken
            </Link>
          ) : undefined
        }
      />
      <Card>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-4">
          {[
            { icon: CalendarDays, label: "Datum", value: dateLabel },
            {
              icon: Clock3,
              label: "Tijd",
              value: `${lesson.start_time.slice(0, 5)}–${lesson.end_time.slice(0, 5)}`,
            },
            { icon: MapPin, label: "Vestiging", value: lesson.location.name },
            {
              icon: UserRound,
              label: "Instructeur",
              value: lesson.instructor_label || "Nog niet toegewezen",
            },
          ].map((fact) => (
            <div className="bg-card px-4 py-3" key={fact.label}>
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <fact.icon className="h-3.5 w-3.5" />
                {fact.label}
              </dt>
              <dd className="mt-0.5 truncate text-sm font-medium">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
        {showRoute ? (
          <ol
            aria-label="Van les naar invalopdracht"
            className="flex flex-wrap items-center gap-x-1.5 gap-y-2 border-t border-border px-4 py-3 text-xs font-medium"
          >
            {routeSteps.map((step, index) => (
              <li className="flex items-center gap-1.5" key={step.label}>
                {index > 0 ? (
                  <ArrowRight aria-hidden="true" className="h-3 w-3 text-muted-foreground" />
                ) : null}
                <span
                  aria-current={index === currentStep ? "step" : undefined}
                  className={
                    step.done
                      ? "inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-primary-soft-foreground"
                      : index === currentStep
                        ? "inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-amber-800 ring-1 ring-warning/30"
                        : "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
                  }
                >
                  {step.done ? <Check aria-hidden="true" className="h-3 w-3" /> : null}
                  {step.label}
                </span>
              </li>
            ))}
          </ol>
        ) : null}
      </Card>
      {changed ? (
        <Alert variant="warning">
          <AlertDescription>
            Het rooster is gewijzigd na plaatsing van de invalopdracht.
            Controleer de opdracht en stem wijzigingen af met de instructeur.
            Gepubliceerde afspraken zijn behouden.
          </AlertDescription>
        </Alert>
      ) : null}
      {lesson.replacement && lesson.cancelled ? (
        <Alert variant="warning">
          <AlertDescription>
            De les is geannuleerd. Handel ook de gekoppelde invalopdracht af;
            die wordt niet automatisch geannuleerd.
          </AlertDescription>
        </Alert>
      ) : null}
      {synthetic ? (
        <Card>
          <CardContent className="space-y-1.5 pt-5 text-sm">
            <p className="font-medium">Voorbeeldrooster · synthetische les</p>
            <p className="text-muted-foreground">
              {lesson.sport.name} · {lesson.lesson_type}
            </p>
            <p className="text-muted-foreground">
              Deze voorbeeldles kan geen echte invalopdracht publiceren. Beheer
              het voorbeeldrooster bij Roosterbronnen.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Les bewerken</CardTitle>
          </CardHeader>
          <CardContent>
              <LessonForm
                locations={org.locations.filter(
                  (item) => item.id === lesson.location_id,
                )}
                sports={sports ?? []}
                initial={{
                  externalId: lesson.external_id,
                  revision: lesson.revision,
                  locationId: lesson.location_id,
                  title: lesson.title,
                  sportId: lesson.sport_id,
                  lessonType: lesson.lesson_type,
                  date: lesson.starts_on,
                  startTime: lesson.start_time.slice(0, 5),
                  endTime: lesson.end_time.slice(0, 5),
                  instructor: lesson.instructor_label,
                  needsSubstitute: lesson.needs_substitute,
                  cancelled: lesson.cancelled,
                }}
              />
          </CardContent>
        </Card>
      )}
    </Page>
  );
}
