import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ChatPanel } from "@/components/chat/chat-panel";
import { Badge } from "@/components/ui/badge";
import { getSessionProfile } from "@/lib/auth/session";
import { subscriptionGrantsAccess } from "@/lib/billing/access";
import { jobStatusLabels } from "@/lib/labels";
import { getOrgContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
import type { Chat, ChatMessage, Job, Subscription } from "@/types/database";

export const metadata: Metadata = {
  title: "Chat",
};

interface ChatDetail extends Chat {
  job: Pick<Job, "id" | "title" | "status" | "location_id"> | null;
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
      job:jobs (id, title, status, location_id),
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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
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
            <p className="truncate font-semibold">{counterpartName}</p>
            <Link
              className="block truncate text-sm text-primary hover:underline"
              href={jobHref}
            >
              {chat.job?.title}
            </Link>
          </div>
        </div>
        {chat.job ? (
          <Badge variant="outline">{jobStatusLabels[chat.job.status]}</Badge>
        ) : null}
      </div>

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
