"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

function notificationDestination(href: string, role: UserRole): string {
  const fallback = "/meldingen";

  try {
    const baseUrl = "https://sportmatch.local";
    const destination = new URL(href, baseUrl);
    if (destination.origin !== baseUrl) {
      return fallback;
    }

    let pathname = destination.pathname;
    const instructorJobMatch = pathname.match(/^\/opdrachten\/([0-9a-f-]+)$/i);
    const organizationJobMatch = pathname.match(
      /^\/organisatie\/opdrachten\/([0-9a-f-]+)$/i,
    );

    // Oude meldingen kunnen nog de detailroute voor de andere rol bevatten.
    // Corrigeer die bij openen, zonder bestaande notificatierijen te muteren.
    if (role === "organization" && instructorJobMatch) {
      pathname = `/organisatie/opdrachten/${instructorJobMatch[1]}`;
    } else if (role === "instructor" && organizationJobMatch) {
      pathname = `/opdrachten/${organizationJobMatch[1]}`;
    }

    return `${pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallback;
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile || !supabase) {
    return;
  }

  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", profile.id)
    .is("read_at", null);

  revalidatePath("/", "layout");
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile || !supabase) {
    return;
  }

  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", profile.id);

  revalidatePath("/", "layout");
}

export async function openNotificationAction(
  notificationId: string,
): Promise<void> {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile || !supabase) {
    redirect("/login");
  }

  const { data: notification } = await supabase
    .from("notifications")
    .select("id, href")
    .eq("id", notificationId)
    .eq("user_id", profile.id)
    .maybeSingle();

  if (!notification) {
    redirect("/meldingen");
  }

  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notification.id)
    .eq("user_id", profile.id);

  revalidatePath("/", "layout");
  revalidatePath("/meldingen");
  redirect(notificationDestination(notification.href as string, profile.role));
}
