import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { LessonForm } from "@/components/agenda/lesson-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Page, PageHeader } from "@/components/ui/page";
import { getOrgContext } from "@/lib/org/context";
import { getScheduledLesson } from "@/lib/agenda/lessons";
import { createClient } from "@/lib/supabase/server";

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
  return (
    <Page width="narrow">
      <PageHeader
        title={lesson.title}
        back={{ href: `/agenda?lesson=${id}`, label: "Agenda" }}
        description={`${lesson.location.name} · ${lesson.starts_on} · ${lesson.start_time.slice(0, 5)}–${lesson.end_time.slice(0, 5)}`}
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
              className={buttonVariants()}
              href={`/organisatie/opdrachten/nieuw?lesson=${id}`}
            >
              Invalopdracht aanmaken
            </Link>
          ) : undefined
        }
      />
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
          <CardContent className="space-y-2 pt-5">
            <p>Voorbeeldrooster · synthetische les</p>
            <p>
              {lesson.sport.name} · {lesson.lesson_type}
            </p>
            <p>
              Instructeur: {lesson.instructor_label || "Nog niet toegewezen"}
            </p>
            <p>
              {lesson.needs_substitute
                ? "Inval nodig · nog geen opdracht"
                : "Ingeplande les"}
            </p>
            <p className="text-sm text-muted-foreground">
              Deze voorbeeldles kan geen echte invalopdracht publiceren. Beheer
              het voorbeeldrooster bij Roosterbronnen.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-5">
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
