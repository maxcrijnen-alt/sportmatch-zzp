import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowUpRight, BellOff, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Page, PageHeader } from "@/components/ui/page";
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
    <Page width="narrow">
      <PageHeader
        actions={
          hasUnread ? (
            <form action={markAllNotificationsRead}>
              <Button className="w-full sm:w-auto" size="sm" type="submit" variant="outline">
                <CheckCheck className="h-4 w-4" />
                Alles gelezen
              </Button>
            </form>
          ) : null
        }
        title="Meldingen"
      />

      {notifications.length === 0 ? (
        <Card>
          <EmptyState
            icon={BellOff}
            title="Nog geen meldingen. Zodra er iets gebeurt, zie je het hier."
          />
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          {notifications.map((notification) => {
            const inner = (
              <div
                className={cn(
                  "border-t border-border px-4 py-3.5 transition-colors first:border-t-0 sm:px-5",
                  notification.read_at
                    ? "bg-card hover:bg-subtle"
                    : "bg-primary-soft/60 hover:bg-primary-soft",
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
    </Page>
  );
}
