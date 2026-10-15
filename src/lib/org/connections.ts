"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionProfile } from "@/lib/auth/session";
import { getOrgContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";

export interface ConnectionActionState {
  connected: boolean;
  error: string | null;
}

const connectionSchema = z.object({
  instructorId: z.string().uuid(),
  connected: z.enum(["true", "false"]),
});

export async function setInstructorConnectionAction(
  previous: ConnectionActionState,
  formData: FormData,
): Promise<ConnectionActionState> {
  const parsed = connectionSchema.safeParse({
    instructorId: formData.get("instructorId"),
    connected: formData.get("connected"),
  });
  if (!parsed.success) {
    return { ...previous, error: "Deze instructeur kon niet worden opgeslagen." };
  }

  const profile = await getSessionProfile();
  const orgContext = await getOrgContext();
  const supabase = await createClient();
  if (profile?.role !== "organization" || !orgContext || !supabase) {
    return { ...previous, error: "Geen toegang tot deze poule." };
  }

  const connected = parsed.data.connected === "true";
  const { error } = await supabase.rpc("set_instructor_connection", {
    p_organization: orgContext.organization.id,
    p_instructor: parsed.data.instructorId,
    p_connected: connected,
  });
  if (error) {
    return { ...previous, error: "Opslaan is niet gelukt. Probeer het opnieuw." };
  }

  revalidatePath("/organisatie/kandidaten");
  revalidatePath(`/organisatie/kandidaten/${parsed.data.instructorId}`);
  revalidatePath("/organisatie/opdrachten/[id]", "page");
  return { connected, error: null };
}
