import Link from "next/link";
import { redirect } from "next/navigation";
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
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap gap-2 border-b border-border pb-4">
        {adminNav.map((item) => (
          <Link
            className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
