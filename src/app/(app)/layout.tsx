import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/shell";
import { getSessionProfile } from "@/lib/auth/session";
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

  if (supabase) {
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .is("read_at", null);
    unreadCount = count ?? 0;
  }

  return (
    <AppShell
      fullName={profile.full_name}
      role={profile.role}
      unreadCount={unreadCount}
    >
      {children}
    </AppShell>
  );
}
