import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowUpRight, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSessionProfile } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/labels";
import {
  markAllNotificationsRead,
  openNotificationAction,
} from "@/lib/notifications/actions";
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
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8">
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
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <BellOff className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nog geen meldingen. Zodra er iets gebeurt, zie je het hier.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {notifications.map((notification) => {
            const inner = (
              <div
                className={cn(
                  "border-t border-border p-3 transition-colors first:border-t-0",
                  notification.read_at
                    ? "bg-card"
                    : "bg-primary/5",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    {!notification.read_at ? (
                      <span
                        aria-label="Ongelezen"
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                      />
                    ) : null}
                    <p className="text-sm font-medium">{notification.title}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <time className="text-xs text-muted-foreground">
                      {formatDateTime(notification.created_at)}
                    </time>
                    {notification.href ? (
                      <ArrowUpRight className="h-4 w-4 text-primary" />
                    ) : null}
                  </div>
                </div>
                {notification.body ? (
                  <p className="mt-1 pl-4 text-sm text-muted-foreground">
                    {notification.body}
                  </p>
                ) : null}
              </div>
            );

            return notification.href ? (
              <form
                action={openNotificationAction.bind(null, notification.id)}
                key={notification.id}
              >
                <button
                  className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  type="submit"
                >
                  {inner}
                </button>
              </form>
            ) : (
              <div key={notification.id}>{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
