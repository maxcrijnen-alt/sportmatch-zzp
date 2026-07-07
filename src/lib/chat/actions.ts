"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function sendChatMessageAction(
  chatId: string,
  body: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  if (!supabase) {
    return { error: "Je bent niet ingelogd." };
  }

  const { error } = await supabase.rpc("send_chat_message", {
    p_chat: chatId,
    p_body: body,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/berichten/${chatId}`);
  return { error: null };
}
