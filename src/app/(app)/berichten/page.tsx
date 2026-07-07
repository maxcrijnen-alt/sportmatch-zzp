import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { getSessionProfile } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/labels";
import { getOrgContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
import type { Chat } from "@/types/database";

export const metadata: Metadata = {
  title: "Berichten",
};

interface ChatRow extends Chat {
  job: { title: string } | null;
  organization: { name: string } | null;
}

export default async function BerichtenPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile || !supabase) {
    redirect("/login");
  }

  const orgContext = profile.role === "organization" ? await getOrgContext() : null;

  let query = supabase
    .from("chats")
    .select(
      `*,
      job:jobs (title),
      organization:organizations (name)`,
    )
    .order("last_message_at", { ascending: false })
    .limit(100);

  if (orgContext) {
    query = query.eq("organization_id", orgContext.organization.id);
  } else {
    query = query.eq("instructor_id", profile.id);
  }

  const { data } = await query;
  const chats = (data as unknown as ChatRow[] | null) ?? [];

  // Namen van instructeurs voor de organisatieweergave
  const instructorNames = new Map<string, string>();
  if (orgContext && chats.length > 0) {
    const { data: instructorProfiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in(
        "id",
        chats.map((chat) => chat.instructor_id),
      );
    for (const row of instructorProfiles ?? []) {
      instructorNames.set(row.id as string, row.full_name as string);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Berichten</h1>
        <p className="text-sm text-muted-foreground">
          Gesprekken per opdracht. Contactgegevens worden pas gedeeld na een
          bevestigde opdracht.
        </p>
      </div>

      {chats.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nog geen gesprekken. Een chat start automatisch zodra er op een
              opdracht wordt gereageerd of uitgenodigd.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {chats.map((chat) => {
            const counterpartName = orgContext
              ? (instructorNames.get(chat.instructor_id) ?? "Instructeur")
              : (chat.organization?.name ?? "Organisatie");

            return (
              <Link className="block" href={`/berichten/${chat.id}`} key={chat.id}>
                <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50">
                  <Avatar name={counterpartName} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{counterpartName}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {chat.job?.title}
                    </p>
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground">
                    {formatDateTime(chat.last_message_at)}
                  </time>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
