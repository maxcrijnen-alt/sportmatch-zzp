import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { InstructorProfile } from "@/types/database";

/** ON CONFLICT reads its private EXCLUDED columns in PostgreSQL. Keep those
 * SELECT privileges revoked; normal INSERT/UPDATE still use the existing RLS.
 * Only the safe primary key is read. A concurrent first save retries UPDATE.
 */
export async function saveInstructorProfile(
  supabase: SupabaseClient,
  input: Partial<InstructorProfile> & Pick<InstructorProfile, "user_id">,
) {
  const { data, error } = await supabase
    .from("instructor_profiles")
    .select("user_id")
    .eq("user_id", input.user_id)
    .maybeSingle();
  if (error) return { error };

  const update = () => supabase
    .from("instructor_profiles")
    .update(input)
    .eq("user_id", input.user_id);
  if (data) return update();

  const inserted = await supabase.from("instructor_profiles").insert(input);
  return inserted.error?.code === "23505" ? update() : inserted;
}
