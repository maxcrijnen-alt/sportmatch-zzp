"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

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
