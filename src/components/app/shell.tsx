"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LogOut, Settings, User } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { navLinksForRole } from "@/components/app/nav-links";
import { signOutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";

interface AppShellProps {
  role: UserRole;
  fullName: string;
  unreadCount: number;
  children: React.ReactNode;
}

export function AppShell({ role, fullName, unreadCount, children }: AppShellProps) {
  const pathname = usePathname();
  const links = navLinksForRole(role);

  const isActive = (href: string) =>
    href === "/dashboard" || href === "/admin" || href === "/organisatie"
      ? pathname === href
      : pathname.startsWith(href);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-card lg:flex">
        <div className="flex h-16 items-center border-b border-border px-5">
          <Link href="/dashboard">
            <Logo />
          </Link>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {links.map((link) => (
            <Link
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive(link.href)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              href={link.href}
              key={link.href}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <form action={signOutAction}>
            <button
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              type="submit"
            >
              <LogOut className="h-4 w-4" />
              Uitloggen
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-h-screen w-full flex-col lg:pl-60">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur">
          <Link className="lg:hidden" href="/dashboard">
            <Logo />
          </Link>
          <div className="hidden text-sm text-muted-foreground lg:block">
            Welkom, <span className="font-medium text-foreground">{fullName}</span>
          </div>
          <div className="flex items-center gap-1">
            <Link
              aria-label="Meldingen"
              className="relative flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted"
              href="/meldingen"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 ? (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.6rem] font-bold text-destructive-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </Link>
            <Link
              aria-label="Profiel"
              className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted"
              href="/profiel"
            >
              <User className="h-5 w-5" />
            </Link>
            <Link
              aria-label="Instellingen"
              className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted"
              href="/instellingen"
            >
              <Settings className="h-5 w-5" />
            </Link>
          </div>
        </header>

        <main className="flex-1 pb-24 lg:pb-8">{children}</main>

        {/* Bottom nav (mobiel): eerste vijf links */}
        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card lg:hidden">
          {links.slice(0, 5).map((link) => (
            <Link
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.65rem] font-medium",
                isActive(link.href) ? "text-primary" : "text-muted-foreground",
              )}
              href={link.href}
              key={link.href}
            >
              <link.icon className="h-5 w-5" />
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
