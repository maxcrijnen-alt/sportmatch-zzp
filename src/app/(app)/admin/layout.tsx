import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { getSessionProfile } from "@/lib/auth/session";

const adminNav = [
  { href: "/admin", label: "Overzicht" },
  { href: "/admin/gebruikers", label: "Gebruikers" },
  { href: "/admin/organisaties", label: "Organisaties" },
  { href: "/admin/vestigingen", label: "Vestigingen" },
  { href: "/admin/opdrachten", label: "Opdrachten" },
  { href: "/admin/documenten", label: "Documenten" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/billing", label: "Billing" },
  { href: "/admin/categorieen", label: "Categorieën" },
  { href: "/admin/statistieken", label: "Statistieken" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getSessionProfile();

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <AdminNav items={adminNav} />
      {children}
    </div>
  );
}
