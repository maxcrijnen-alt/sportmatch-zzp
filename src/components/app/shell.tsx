"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronRight,
  LogOut,
  Menu,
  Settings,
  Star,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Logo, LogoMark } from "@/components/brand/logo";
import {
  LocationSelector,
  type LocationOption,
} from "@/components/app/location-selector";
import { navLinksForRole, secondaryLinks } from "@/components/app/nav-links";
import { Avatar } from "@/components/ui/avatar";
import { signOutAction } from "@/lib/auth/actions";
import { LOCATION_FILTER_COOKIE } from "@/lib/org/location-filter-constants";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";

interface AppShellProps {
  role: UserRole;
  fullName: string;
  unreadCount: number;
  hasPendingReview?: boolean;
  locations?: LocationOption[];
  initialLocationId?: string | null;
  children: React.ReactNode;
}

export function AppShell({
  role,
  fullName,
  unreadCount,
  hasPendingReview = false,
  locations = [],
  initialLocationId = null,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const links = navLinksForRole(role);
  const validLocationIds = useMemo(
    () => new Set(locations.map((location) => location.id)),
    [locations],
  );
  const [locationId, setLocationId] = useState(
    initialLocationId && validLocationIds.has(initialLocationId)
      ? initialLocationId
      : "",
  );
  const [mobileMenu, setMobileMenu] = useState({ pathname, open: false });
  // Reset the menu before the next route renders.
  if (mobileMenu.pathname !== pathname) {
    setMobileMenu({ pathname, open: false });
  }
  const mobileMenuOpen = mobileMenu.pathname === pathname && mobileMenu.open;
  const setMobileMenuOpen = (nextOpen: React.SetStateAction<boolean>) => {
    setMobileMenu((current) => ({
      pathname,
      open:
        typeof nextOpen === "function"
          ? nextOpen(current.pathname === pathname && current.open)
          : nextOpen,
    }));
  };

  useEffect(() => {
    if (role !== "organization" || locations.length === 0) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const requested = params.get("location");
    const stored = window.localStorage.getItem(LOCATION_FILTER_COOKIE);
    const nextLocation =
      requested && validLocationIds.has(requested)
        ? requested
        : initialLocationId && validLocationIds.has(initialLocationId)
          ? initialLocationId
          : stored && validLocationIds.has(stored)
            ? stored
            : "";

    const frame = window.requestAnimationFrame(() => {
      setLocationId(nextLocation);
    });
    if (nextLocation) {
      window.localStorage.setItem(LOCATION_FILTER_COOKIE, nextLocation);
      document.cookie = `${LOCATION_FILTER_COOKIE}=${encodeURIComponent(nextLocation)}; Path=/; Max-Age=31536000; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
    }

    return () => window.cancelAnimationFrame(frame);
  }, [initialLocationId, locations.length, role, validLocationIds]);

  const updateLocation = (nextLocation: string) => {
    const safeLocation = validLocationIds.has(nextLocation) ? nextLocation : "";
    setLocationId(safeLocation);

    if (safeLocation) {
      window.localStorage.setItem(LOCATION_FILTER_COOKIE, safeLocation);
      document.cookie = `${LOCATION_FILTER_COOKIE}=${encodeURIComponent(safeLocation)}; Path=/; Max-Age=31536000; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
    } else {
      window.localStorage.removeItem(LOCATION_FILTER_COOKIE);
      document.cookie = `${LOCATION_FILTER_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    }

    const params = new URLSearchParams(window.location.search);
    if (safeLocation) {
      params.set("location", safeLocation);
    } else {
      params.delete("location");
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
    router.refresh();
  };

  const withLocation = (href: string) =>
    role === "organization" && locationId
      ? `${href}${href.includes("?") ? "&" : "?"}location=${encodeURIComponent(locationId)}`
      : href;

  const isActive = (href: string) =>
    href === "/dashboard" || href === "/admin" || href === "/organisatie"
      ? pathname === href
      : pathname.startsWith(href);

  const mobilePrimaryLinks = links.slice(0, 4);
  const mobileMoreLinks = links.slice(4);
  const mobileMoreActive =
    mobileMoreLinks.some((link) => isActive(link.href)) ||
    secondaryLinks.some((link) => isActive(link.href));

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenu((current) => ({ ...current, open: false }));
      }
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileMenuOpen]);

  const roleLabel =
    role === "organization"
      ? "Sportschool"
      : role === "admin"
        ? "Beheerder"
        : "Instructeur";

  const iconLinkClassName = (active: boolean) =>
    cn(
      "relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
      active
        ? "bg-primary-soft text-primary"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card lg:flex">
        <div className="flex h-16 shrink-0 items-center px-5">
          <Link
            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            href="/dashboard"
          >
            <Logo />
          </Link>
        </div>
        <nav
          aria-label="Hoofdnavigatie"
          className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3"
        >
          {links.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                  active
                    ? "bg-primary-soft font-semibold text-primary-soft-foreground"
                    : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                href={withLocation(link.href)}
                key={link.href}
              >
                <link.icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0",
                    active
                      ? "text-primary"
                      : "text-muted-foreground/80 group-hover:text-foreground",
                  )}
                />
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-1 border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-lg px-2.5 py-2">
            <Avatar name={fullName} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium leading-5">{fullName}</p>
              <p className="text-xs leading-4 text-muted-foreground">{roleLabel}</p>
            </div>
          </div>
          <form action={signOutAction}>
            <button
              className="flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              type="submit"
            >
              <LogOut className="h-[18px] w-[18px]" />
              Uitloggen
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-h-screen w-full min-w-0 flex-col lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border bg-card/90 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-card/75 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 lg:hidden"
              href="/dashboard"
            >
              <LogoMark className="h-8 w-8 sm:hidden" />
              <span className="sr-only sm:hidden">Dashboard</span>
              <Logo className="hidden sm:inline-flex lg:hidden" />
            </Link>
            {role === "organization" && locations.length > 0 ? (
              <LocationSelector
                locations={locations}
                onChange={updateLocation}
                value={locationId}
              />
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Link
              aria-label="Meldingen"
              className={iconLinkClassName(isActive("/meldingen"))}
              href="/meldingen"
            >
              <Bell className="h-[18px] w-[18px]" />
              {unreadCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.6rem] font-bold text-destructive-foreground ring-2 ring-card">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </Link>
            <Link
              aria-label="Profiel"
              className={iconLinkClassName(isActive("/profiel"))}
              href="/profiel"
            >
              <UserRound className="h-[18px] w-[18px]" />
            </Link>
            <Link
              aria-label="Instellingen"
              className={iconLinkClassName(isActive("/instellingen"))}
              href="/instellingen"
            >
              <Settings className="h-[18px] w-[18px]" />
            </Link>
          </div>
        </header>

        <main className="flex-1 pb-28 lg:pb-10">
          {hasPendingReview ? (
            <div className="border-b border-warning/20 bg-warning-soft px-4 py-2.5 sm:px-6 lg:px-8">
              <div className="mx-auto flex max-w-6xl flex-col gap-1.5 text-sm sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-2 font-medium text-amber-900">
                  <Star className="h-4 w-4 fill-warning text-warning" />
                  Je hebt nog een beoordeling openstaan
                </p>
                <Link
                  className="inline-flex items-center gap-1 font-semibold text-amber-800 hover:underline"
                  href={role === "organization" ? "/organisatie/reviews" : "/reviews"}
                >
                  Beoordeling afronden
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ) : null}
          {children}
        </main>

        {mobileMenuOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              aria-label="Sluit meer-menu"
              className="absolute inset-0 bg-secondary/40 backdrop-blur-[2px]"
              onClick={() => setMobileMenuOpen(false)}
              type="button"
            />
            <section
              aria-label="Meer navigatie"
              className="absolute inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] max-h-[72vh] overflow-y-auto rounded-t-2xl border-t border-border bg-card px-4 pb-4 pt-2 shadow-overlay"
            >
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-border-strong" />
              <div className="mb-3 flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={fullName} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{fullName}</p>
                    <p className="text-xs text-muted-foreground">{roleLabel}</p>
                  </div>
                </div>
                <button
                  aria-label="Sluit menu"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                  type="button"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="grid grid-cols-2 gap-2" aria-label="Overige hoofdnavigatie">
                {mobileMoreLinks.map((link) => (
                  <Link
                    aria-current={isActive(link.href) ? "page" : undefined}
                    className={cn(
                      "flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive(link.href)
                        ? "border-primary/20 bg-primary-soft text-primary-soft-foreground"
                        : "border-border text-foreground hover:bg-muted",
                    )}
                    href={withLocation(link.href)}
                    key={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <link.icon
                      className={cn(
                        "h-5 w-5 shrink-0",
                        isActive(link.href) ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="my-3 h-px bg-border" />

              <nav className="grid gap-0.5" aria-label="Accountnavigatie">
                {secondaryLinks.map((link) => (
                  <Link
                    aria-current={isActive(link.href) ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                      isActive(link.href)
                        ? "bg-primary-soft text-primary-soft-foreground"
                        : "text-foreground hover:bg-muted",
                    )}
                    href={link.href}
                    key={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="relative">
                      <link.icon className="h-5 w-5 text-muted-foreground" />
                      {link.href === "/meldingen" && unreadCount > 0 ? (
                        <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.6rem] font-bold text-destructive-foreground">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      ) : null}
                    </span>
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="my-3 h-px bg-border" />

              <form action={signOutAction}>
                <button
                  className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  type="submit"
                >
                  <LogOut className="h-5 w-5" />
                  Uitloggen
                </button>
              </form>
            </section>
          </div>
        ) : null}

        {/* Bottom nav (mobiel): vier kernacties + Meer */}
        <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
          {mobilePrimaryLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                  active ? "text-primary-soft-foreground" : "text-muted-foreground",
                )}
                href={withLocation(link.href)}
                key={link.href}
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    active && "bg-primary-soft text-primary",
                  )}
                >
                  <link.icon className="h-5 w-5" />
                </span>
                <span className="max-w-full truncate px-1">{link.label}</span>
              </Link>
            );
          })}
          <button
            aria-expanded={mobileMenuOpen}
            aria-label="Meer navigatie"
            className={cn(
              "flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium",
              mobileMoreActive || mobileMenuOpen
                ? "text-primary-soft-foreground"
                : "text-muted-foreground",
            )}
            onClick={() => setMobileMenuOpen((open) => !open)}
            type="button"
          >
            <span
              className={cn(
                "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                (mobileMoreActive || mobileMenuOpen) && "bg-primary-soft text-primary",
              )}
            >
              <Menu className="h-5 w-5" />
            </span>
            Meer
          </button>
        </nav>
      </div>
    </div>
  );
}
