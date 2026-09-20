import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/shell";
import { getSessionProfile } from "@/lib/auth/session";
import { getOrgContext } from "@/lib/org/context";
import { resolveLocationFilter } from "@/lib/org/location-filter";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getSessionProfile();

  if (!profile) {
    redirect("/login");
  }

  const supabase = await createClient();
  let unreadCount = 0;
  let hasPendingReview = false;

  if (supabase) {
    const [{ count }, pendingReviewResult] = await Promise.all([
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .is("read_at", null),
      supabase.rpc("has_pending_review", { target_user: profile.id }),
    ]);
    unreadCount = count ?? 0;
    hasPendingReview = pendingReviewResult.data === true;
  }

  const orgContext =
    profile.role === "organization" ? await getOrgContext() : null;
  const selectedLocationId = orgContext
    ? await resolveLocationFilter(orgContext.locations)
    : null;

  return (
    <AppShell
      fullName={profile.full_name}
      hasPendingReview={hasPendingReview}
      initialLocationId={selectedLocationId}
      locations={orgContext?.locations.map((location) => ({
        id: location.id,
        name: location.name,
      }))}
      role={profile.role}
      unreadCount={unreadCount}
    >
      {children}
    </AppShell>
  );
}
