import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSessionProfile } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/labels";
import { markAllNotificationsRead } from "@/lib/notifications/actions";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types/database";

export const metadata: Metadata = {
  title: "Meldingen",
};

export default async function MeldingenPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile || !supabase) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const notifications = (data as Notification[] | null) ?? [];
  const hasUnread = notifications.some((notification) => !notification.read_at);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meldingen</h1>
          <p className="text-sm text-muted-foreground">
            Updates over opdrachten, reacties en berichten.
          </p>
        </div>
        {hasUnread ? (
          <form action={markAllNotificationsRead}>
            <Button size="sm" type="submit" variant="outline">
              Alles gelezen
            </Button>
          </form>
        ) : null}
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <BellOff className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nog geen meldingen. Zodra er iets gebeurt, zie je het hier.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => {
            const inner = (
              <div
                className={cn(
                  "rounded-lg border p-4 transition-colors",
                  notification.read_at
                    ? "border-border bg-card"
                    : "border-primary/30 bg-primary/5",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">{notification.title}</p>
                  <time className="shrink-0 text-xs text-muted-foreground">
                    {formatDateTime(notification.created_at)}
                  </time>
                </div>
                {notification.body ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {notification.body}
                  </p>
                ) : null}
              </div>
            );

            return notification.href ? (
              <Link className="block" href={notification.href} key={notification.id}>
                {inner}
              </Link>
            ) : (
              <div key={notification.id}>{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
