import {
  Bell,
  Briefcase,
  Building2,
  CalendarRange,
  CreditCard,
  FileCheck2,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Search,
  Settings,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";
import type { UserRole } from "@/types/database";

export interface NavLink {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const instructorLinks: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/opdrachten", label: "Opdrachten", icon: Search },
  { href: "/mijn-reacties", label: "Mijn reacties", icon: Inbox },
  { href: "/berichten", label: "Berichten", icon: MessageSquare },
  { href: "/beschikbaarheid", label: "Beschikbaarheid", icon: CalendarRange },
  { href: "/documenten", label: "Documenten", icon: FileCheck2 },
  { href: "/reviews", label: "Reviews", icon: Star },
  { href: "/abonnement", label: "Abonnement", icon: CreditCard },
];

const organizationLinks: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/organisatie/opdrachten", label: "Opdrachten", icon: Briefcase },
  { href: "/organisatie/kandidaten", label: "Kandidaten", icon: Users },
  { href: "/berichten", label: "Berichten", icon: MessageSquare },
  { href: "/organisatie", label: "Organisatie", icon: Building2 },
  { href: "/organisatie/reviews", label: "Reviews", icon: Star },
  { href: "/abonnement", label: "Abonnement", icon: CreditCard },
];

const adminLinks: NavLink[] = [
  { href: "/admin", label: "Admin", icon: ShieldCheck },
  { href: "/admin/gebruikers", label: "Gebruikers", icon: Users },
  { href: "/admin/documenten", label: "Documenten", icon: FileCheck2 },
  { href: "/admin/opdrachten", label: "Opdrachten", icon: Briefcase },
  { href: "/admin/billing", label: "Billing", icon: CreditCard },
  { href: "/admin/statistieken", label: "Statistieken", icon: LayoutDashboard },
];

export function navLinksForRole(role: UserRole): NavLink[] {
  switch (role) {
    case "organization":
      return organizationLinks;
    case "admin":
      return adminLinks;
    default:
      return instructorLinks;
  }
}

export const secondaryLinks: NavLink[] = [
  { href: "/meldingen", label: "Meldingen", icon: Bell },
  { href: "/profiel", label: "Profiel", icon: Users },
  { href: "/instellingen", label: "Instellingen", icon: Settings },
];
