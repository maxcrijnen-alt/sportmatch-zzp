"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Mockbetalingen zijn uitsluitend voor geïsoleerde demoaccounts.
 * De databasefuncties registreren billing events zodat de historie compleet is.
 */
export async function mockActivateSubscriptionAction(
  subscriptionId: string,
): Promise<void> {
  const supabase = await createClient();

  if (!supabase) {
    return;
  }

  const { error } = await supabase.rpc("mock_activate_subscription", {
    p_subscription: subscriptionId,
  });
  if (error) redirect("/abonnement?fout=activatie");

  revalidatePath("/abonnement");
  revalidatePath("/", "layout");
  redirect("/abonnement");
}

export async function cancelSubscriptionAction(
  subscriptionId: string,
): Promise<void> {
  const supabase = await createClient();

  if (!supabase) {
    return;
  }

  const { error } = await supabase.rpc("cancel_subscription", { p_subscription: subscriptionId });
  if (error) redirect("/abonnement?fout=opzeggen");

  revalidatePath("/abonnement");
  revalidatePath("/", "layout");
  redirect("/abonnement");
}
