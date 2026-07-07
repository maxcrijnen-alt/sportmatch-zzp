"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Mock-billinglaag. Wordt later vervangen door een echte provider (Mollie).
 * De databasefuncties registreren billing events zodat de historie compleet is.
 */
export async function mockActivateSubscriptionAction(
  subscriptionId: string,
): Promise<void> {
  const supabase = await createClient();

  if (!supabase) {
    return;
  }

  await supabase.rpc("mock_activate_subscription", {
    p_subscription: subscriptionId,
  });

  revalidatePath("/abonnement");
  revalidatePath("/", "layout");
}

export async function cancelSubscriptionAction(
  subscriptionId: string,
): Promise<void> {
  const supabase = await createClient();

  if (!supabase) {
    return;
  }

  await supabase.rpc("cancel_subscription", { p_subscription: subscriptionId });

  revalidatePath("/abonnement");
  revalidatePath("/", "layout");
}
