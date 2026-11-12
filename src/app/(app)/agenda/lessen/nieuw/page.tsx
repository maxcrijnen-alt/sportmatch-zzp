import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { LessonForm } from "@/components/agenda/lesson-form";
import { Card, CardContent } from "@/components/ui/card";
import { Page, PageHeader } from "@/components/ui/page";
import { getOrgContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
import { dateInAmsterdam } from "@/lib/datetime/amsterdam";

export default async function NewLessonPage() {
  const org = await getOrgContext();
  const client = await createClient();
  if (!org || !client) redirect("/agenda");
  const { data: sports } = await client
    .from("sports")
    .select("id,name")
    .eq("is_active", true)
    .order("name");
  return (
    <Page width="narrow">
      <PageHeader
        title="Les toevoegen"
        back={{ href: "/agenda", label: "Agenda" }}
        description="Plan ook lessen waarvoor geen invalopdracht nodig is."
      />
      <Card>
        <CardContent className="pt-5">
          <LessonForm
            locations={org.locations}
            sports={sports ?? []}
            initial={{
              externalId: randomUUID(),
              date: dateInAmsterdam(new Date()),
            }}
          />
        </CardContent>
      </Card>
    </Page>
  );
}
