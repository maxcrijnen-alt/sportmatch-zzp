import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  Inbox,
  MailQuestion,
  MapPin,
  MessageSquare,
  Send,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getSessionProfile } from "@/lib/auth/session";
import { formatDate, formatDateTime, formatTime } from "@/lib/labels";
import { getOrgContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { Chat, ChatMessage, JobStatus } from "@/types/database";

export const metadata: Metadata = {
  title: "Berichten",
};

type MessageTab = "incoming" | "sent" | "invitations" | "completed";

const tabs: Array<{
  id: MessageTab;
  label: string;
  icon: typeof Inbox;
}> = [
  { id: "incoming", label: "Binnengekomen", icon: Inbox },
  { id: "sent", label: "Verzonden", icon: Send },
  { id: "invitations", label: "Uitnodigingen", icon: MailQuestion },
  { id: "completed", label: "Afgerond", icon: CheckCircle2 },
];

interface ChatJobSummary {
  id: string;
  title: string;
  status: JobStatus;
  starts_on: string;
  start_time: string;
  end_time: string;
  custom_lesson_type: string | null;
  sport: { name: string } | null;
  lesson_type: { name: string } | null;
  location: { name: string } | null;
}

interface ChatRow extends Chat {
  job: ChatJobSummary | null;
  organization: { name: string } | null;
}

interface BerichtenPageProps {
  searchParams: Promise<{ tab?: string }>;
}

function relationKey(jobId: string, instructorId: string): string {
  return `${jobId}:${instructorId}`;
}

function isKnownTab(value: string | undefined): value is MessageTab {
  return tabs.some((tab) => tab.id === value);
}

export default async function BerichtenPage({
  searchParams,
}: BerichtenPageProps) {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile || !supabase) {
    redirect("/login");
  }

  const params = await searchParams;
  const activeTab: MessageTab = isKnownTab(params.tab)
    ? params.tab
    : "incoming";
  const orgContext = profile.role === "organization" ? await getOrgContext() : null;

  let query = supabase
    .from("chats")
    .select(
      `*,
      job:jobs (
        id, title, status, starts_on, start_time, end_time,
        custom_lesson_type,
        sport:sports (name),
        lesson_type:lesson_types (name),
        location:organization_locations (name)
      ),
      organization:organizations (name)`,
    )
    .order("last_message_at", { ascending: false })
    .limit(100);

  if (orgContext) {
    query = query.eq("organization_id", orgContext.organization.id);
  } else {
    query = query.eq("instructor_id", profile.id);
  }

  const { data, error: chatsError } = await query;
  if (chatsError) {
    console.error("Berichten konden niet worden geladen", chatsError.message);
  }
  const chats = (data as unknown as ChatRow[] | null) ?? [];
  const chatIds = chats.map((chat) => chat.id);
  const jobIds = Array.from(new Set(chats.map((chat) => chat.job_id)));

  const [messagesResult, applicationsResult, invitationsResult, namesResult] =
    await Promise.all([
      chatIds.length > 0
        ? supabase
            .from("chat_messages")
            .select("id, chat_id, sender_id, body, system_event, created_at")
            .in("chat_id", chatIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      jobIds.length > 0
        ? supabase
            .from("job_applications")
            .select("job_id, instructor_id")
            .in("job_id", jobIds)
        : Promise.resolve({ data: [] }),
      jobIds.length > 0
        ? supabase
            .from("job_invitations")
            .select("job_id, instructor_id")
            .in("job_id", jobIds)
        : Promise.resolve({ data: [] }),
      orgContext && chats.length > 0
        ? supabase
            .from("profiles")
            .select("id, full_name")
            .in(
              "id",
              Array.from(new Set(chats.map((chat) => chat.instructor_id))),
            )
        : Promise.resolve({ data: [] }),
    ]);

  const messages =
    (messagesResult.data as Pick<
      ChatMessage,
      "id" | "chat_id" | "sender_id" | "body" | "system_event" | "created_at"
    >[] | null) ?? [];
  const latestActivityByChat = new Map<string, (typeof messages)[number]>();
  const latestHumanMessageByChat = new Map<string, (typeof messages)[number]>();

  for (const message of messages) {
    if (!latestActivityByChat.has(message.chat_id)) {
      latestActivityByChat.set(message.chat_id, message);
    }
    if (message.sender_id && !latestHumanMessageByChat.has(message.chat_id)) {
      latestHumanMessageByChat.set(message.chat_id, message);
    }
  }

  const applicationKeys = new Set(
    (applicationsResult.data ?? []).map((row) =>
      relationKey(row.job_id as string, row.instructor_id as string),
    ),
  );
  const invitationKeys = new Set(
    (invitationsResult.data ?? []).map((row) =>
      relationKey(row.job_id as string, row.instructor_id as string),
    ),
  );
  const instructorNames = new Map<string, string>(
    (namesResult.data ?? []).map((row) => [
      row.id as string,
      row.full_name as string,
    ]),
  );

  const isIncoming = (chat: ChatRow): boolean => {
    const latestHumanMessage = latestHumanMessageByChat.get(chat.id);
    if (latestHumanMessage) {
      return latestHumanMessage.sender_id !== profile.id;
    }

    const key = relationKey(chat.job_id, chat.instructor_id);
    if (orgContext) {
      return applicationKeys.has(key) || !invitationKeys.has(key);
    }
    return invitationKeys.has(key) || !applicationKeys.has(key);
  };

  const isSent = (chat: ChatRow): boolean => {
    const latestHumanMessage = latestHumanMessageByChat.get(chat.id);
    if (latestHumanMessage) {
      return latestHumanMessage.sender_id === profile.id;
    }

    const key = relationKey(chat.job_id, chat.instructor_id);
    return orgContext ? invitationKeys.has(key) : applicationKeys.has(key);
  };

  const matchesTab = (chat: ChatRow, tab: MessageTab): boolean => {
    const isCompleted = chat.job?.status === "completed";
    if (tab === "completed") {
      return isCompleted;
    }
    if (isCompleted) {
      return false;
    }
    if (tab === "invitations") {
      return invitationKeys.has(relationKey(chat.job_id, chat.instructor_id));
    }
    return tab === "incoming" ? isIncoming(chat) : isSent(chat);
  };

  const tabCounts = new Map<MessageTab, number>(
    tabs.map((tab) => [
      tab.id,
      chats.filter((chat) => matchesTab(chat, tab.id)).length,
    ]),
  );
  const visibleChats = chats.filter((chat) => matchesTab(chat, activeTab));

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Berichten</h1>
        <p className="text-sm text-muted-foreground">
          Gesprekken zijn gekoppeld aan een concrete klus. Contactgegevens
          worden pas gedeeld na definitieve bevestiging.
        </p>
      </div>

      <nav
        aria-label="Berichtenfilters"
        className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const selected = tab.id === activeTab;
          return (
            <Link
              aria-current={selected ? "page" : undefined}
              className={cn(
                "flex min-w-max flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                selected
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              href={`/berichten?tab=${tab.id}`}
              key={tab.id}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[0.65rem]",
                  selected ? "bg-primary-foreground/15" : "bg-muted",
                )}
              >
                {tabCounts.get(tab.id) ?? 0}
              </span>
            </Link>
          );
        })}
      </nav>

      {visibleChats.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Geen gesprekken in {tabs.find((tab) => tab.id === activeTab)?.label.toLowerCase()}.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleChats.map((chat) => {
            const counterpartName = orgContext
              ? (instructorNames.get(chat.instructor_id) ?? "Instructeur")
              : (chat.organization?.name ?? "Sportschool");
            const lessonName =
              chat.job?.custom_lesson_type ||
              chat.job?.lesson_type?.name ||
              chat.job?.title ||
              "Les";
            const latestActivity = latestActivityByChat.get(chat.id);

            return (
              <Link className="block" href={`/berichten/${chat.id}`} key={chat.id}>
                <article className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary/5">
                  <div className="flex items-start gap-3">
                    <Avatar name={counterpartName} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{lessonName}</p>
                          <p className="truncate text-sm text-muted-foreground">
                            {counterpartName}
                          </p>
                        </div>
                        {chat.job?.sport?.name ? (
                          <Badge variant="outline">{chat.job.sport.name}</Badge>
                        ) : null}
                      </div>

                      <div className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                        {chat.job ? (
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {formatDate(chat.job.starts_on)} · {formatTime(chat.job.start_time)}–
                            {formatTime(chat.job.end_time)}
                          </span>
                        ) : null}
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {chat.job?.location?.name ?? "Vestiging onbekend"}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                        <p className="min-w-0 truncate text-sm text-muted-foreground">
                          {latestActivity?.body ?? "Gesprek geopend"}
                        </p>
                        <time className="shrink-0 text-xs text-muted-foreground">
                          {formatDateTime(
                            latestActivity?.created_at ?? chat.last_message_at,
                          )}
                        </time>
                      </div>
                    </div>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
