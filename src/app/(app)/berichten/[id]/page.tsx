import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  ExternalLink,
  MapPin,
} from "lucide-react";
import { ChatPanel } from "@/components/chat/chat-panel";
import { Badge } from "@/components/ui/badge";
import { getSessionProfile } from "@/lib/auth/session";
import { subscriptionGrantsAccess } from "@/lib/billing/access";
import {
  formatDate,
  formatTime,
  jobStatusLabels,
} from "@/lib/labels";
import { getOrgContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
import type { Chat, ChatMessage, Job, Subscription } from "@/types/database";

export const metadata: Metadata = {
  title: "Chat",
};

interface ChatDetail extends Chat {
  job:
    | (Pick<
        Job,
        | "id"
        | "title"
        | "status"
        | "location_id"
        | "starts_on"
        | "start_time"
        | "end_time"
        | "custom_lesson_type"
      > & {
        sport: { name: string } | null;
        lesson_type: { name: string } | null;
        location: { name: string } | null;
      })
    | null;
  organization: { name: string } | null;
}

export default async function ChatDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile || !supabase) {
    redirect("/login");
  }

  const { id } = await params;

  const { data: chatData } = await supabase
    .from("chats")
    .select(
      `*,
      job:jobs (
        id, title, status, location_id, starts_on, start_time, end_time,
        custom_lesson_type,
        sport:sports (name),
        lesson_type:lesson_types (name),
        location:organization_locations (name)
      ),
      organization:organizations (name)`,
    )
    .eq("id", id)
    .maybeSingle();

  const chat = chatData as unknown as ChatDetail | null;

  if (!chat) {
    notFound();
  }

  const isInstructor = chat.instructor_id === profile.id;

  const [messagesResult, counterpartResult] = await Promise.all([
    supabase
      .from("chat_messages")
      .select("*")
      .eq("chat_id", chat.id)
      .order("created_at")
      .limit(500),
    isInstructor
      ? Promise.resolve({ data: null })
      : supabase
          .from("profiles")
          .select("full_name")
          .eq("id", chat.instructor_id)
          .maybeSingle(),
  ]);

  const messages = (messagesResult.data as ChatMessage[] | null) ?? [];
  const counterpartName = isInstructor
    ? (chat.organization?.name ?? "Organisatie")
    : ((counterpartResult.data as { full_name: string } | null)?.full_name ??
      "Instructeur");

  // Bepaal of versturen mogelijk is (billing-gate); de RPC dwingt dit ook af.
  let disabledReason: string | null = null;

  if (isInstructor) {
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("instructor_id", profile.id)
      .maybeSingle();
    if (!subscriptionGrantsAccess(subscription as Subscription | null)) {
      disabledReason =
        "Je abonnement of proefperiode is niet actief. Activeer je abonnement om te chatten.";
    }
  } else {
    const orgContext = await getOrgContext();
    if (!orgContext || orgContext.organization.id !== chat.organization_id) {
      disabledReason = "Je bent geen deelnemer van dit gesprek.";
    } else if (chat.job) {
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("location_id", chat.job.location_id)
        .maybeSingle();
      if (!subscriptionGrantsAccess(subscription as Subscription | null)) {
        disabledReason =
          "Het abonnement van deze vestiging is niet actief. Activeer het abonnement om te chatten.";
      }
    }
  }

  const jobHref = isInstructor
    ? `/opdrachten/${chat.job?.id}`
    : `/organisatie/opdrachten/${chat.job?.id}`;
  const lessonName =
    chat.job?.custom_lesson_type ||
    chat.job?.lesson_type?.name ||
    "Lesvorm niet opgegeven";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            aria-label="Terug naar berichten"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-muted"
            href="/berichten"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Gesprek met</p>
            <p className="truncate font-semibold">{counterpartName}</p>
          </div>
        </div>
        {chat.job ? (
          <Badge variant="outline">{jobStatusLabels[chat.job.status]}</Badge>
        ) : null}
      </div>

      {chat.job ? (
        <section
          aria-label="Opdrachtdetails bij dit gesprek"
          className="rounded-lg border border-border bg-card p-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Concrete opdracht
              </p>
              <h1 className="mt-1 text-lg font-semibold">{chat.job.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {chat.job.sport?.name ?? "Sport"} · {lessonName}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium hover:bg-muted"
                href={jobHref}
              >
                Bekijk opdracht <ExternalLink className="h-3.5 w-3.5" />
              </Link>
              <Link
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium hover:bg-muted"
                href={`/agenda?job=${chat.job.id}`}
              >
                Naar agenda <CalendarDays className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <div className="mt-4 grid gap-2 border-t border-border pt-4 text-sm sm:grid-cols-3">
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              {formatDate(chat.job.starts_on)}
            </span>
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Clock3 className="h-4 w-4" />
              {formatTime(chat.job.start_time)}–{formatTime(chat.job.end_time)}
            </span>
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {chat.job.location?.name ?? "Vestiging onbekend"}
            </span>
          </div>
        </section>
      ) : null}

      <ChatPanel
        chatId={chat.id}
        currentUserId={profile.id}
        disabledReason={disabledReason}
        messages={messages}
      />

      <p className="text-center text-xs text-muted-foreground">
        Deel geen telefoonnummers of e-mailadressen vóór bevestiging.
        Contactgegevens worden automatisch gedeeld zodra de opdracht definitief
        is.
      </p>
    </div>
  );
}
