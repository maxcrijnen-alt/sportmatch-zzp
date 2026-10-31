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
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Page, PageHeader } from "@/components/ui/page";
import { TabLinks } from "@/components/ui/tabs";
import { getSessionProfile } from "@/lib/auth/session";
import { formatDate, formatDateTime, formatTime } from "@/lib/labels";
import { getOrgContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
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
    <Page width="medium">
      <PageHeader
        description="Contactgegevens worden pas gedeeld na definitieve bevestiging."
        title="Berichten"
      />

      <TabLinks
        fullWidth
        items={tabs.map((tab) => ({
          href: `/berichten?tab=${tab.id}`,
          label: tab.label,
          icon: tab.icon,
          count: tabCounts.get(tab.id) ?? 0,
          active: tab.id === activeTab,
        }))}
        label="Berichtenfilters"
      />

      {visibleChats.length === 0 ? (
        <Card>
          <EmptyState
            icon={MessageSquare}
            title={`Geen gesprekken in ${tabs.find((tab) => tab.id === activeTab)?.label.toLowerCase()}.`}
          />
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
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
              <Link
                className="block border-t border-border first:border-t-0"
                href={`/berichten/${chat.id}`}
                key={chat.id}
              >
                <article className="px-4 py-4 transition-colors hover:bg-subtle sm:px-5">
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

                      <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
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

                      <div className="mt-2.5 flex items-center justify-between gap-3 rounded-lg bg-subtle px-3 py-2">
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
    </Page>
  );
}
