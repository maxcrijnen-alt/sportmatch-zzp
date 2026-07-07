"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SendHorizonal } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { sendChatMessageAction } from "@/lib/chat/actions";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types/database";

const REFRESH_INTERVAL_MS = 8000;

export function ChatPanel({
  chatId,
  messages,
  currentUserId,
  disabledReason,
}: {
  chatId: string;
  messages: ChatMessage[];
  currentUserId: string;
  disabledReason: string | null;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  // Realtime updates via Supabase; polling blijft als vangnet actief.
  useEffect(() => {
    const supabase = createClient();

    if (!supabase) {
      return;
    }

    const channel = supabase
      .channel(`chat-${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `chat_id=eq.${chatId}`,
        },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [chatId, router]);

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [router]);

  const send = () => {
    const trimmed = body.trim();
    if (!trimmed || isPending) {
      return;
    }

    startTransition(async () => {
      const result = await sendChatMessageAction(chatId, trimmed);
      if (result.error) {
        setError(result.error);
      } else {
        setBody("");
        setError(null);
        router.refresh();
      }
    });
  };

  return (
    <div className="flex h-[calc(100vh-16rem)] flex-col rounded-lg border border-border bg-card lg:h-[calc(100vh-14rem)]">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nog geen berichten.
          </p>
        ) : null}
        {messages.map((message) =>
          message.system_event ? (
            <div className="flex justify-center" key={message.id}>
              <p className="max-w-[85%] rounded-full bg-muted px-4 py-1.5 text-center text-xs text-muted-foreground">
                {message.body}
              </p>
            </div>
          ) : (
            <div
              className={cn(
                "flex",
                message.sender_id === currentUserId
                  ? "justify-end"
                  : "justify-start",
              )}
              key={message.id}
            >
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                  message.sender_id === currentUserId
                    ? "rounded-br-sm bg-primary text-primary-foreground"
                    : "rounded-bl-sm bg-muted",
                )}
              >
                <p className="whitespace-pre-line break-words">{message.body}</p>
                <p
                  className={cn(
                    "mt-1 text-right text-[0.65rem]",
                    message.sender_id === currentUserId
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground",
                  )}
                >
                  {new Date(message.created_at).toLocaleTimeString("nl-NL", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ),
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border p-3">
        {error ? (
          <Alert className="mb-2" variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {disabledReason ? (
          <p className="py-2 text-center text-sm text-muted-foreground">
            {disabledReason}
          </p>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              placeholder="Typ een bericht…"
              rows={1}
              value={body}
            />
            <Button
              aria-label="Versturen"
              disabled={isPending || body.trim().length === 0}
              onClick={send}
              size="icon"
              type="button"
            >
              <SendHorizonal className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
