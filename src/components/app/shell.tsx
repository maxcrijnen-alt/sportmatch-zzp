"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, Menu, Settings, Star, User, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Logo } from "@/components/brand/logo";
import {
  LocationSelector,
  type LocationOption,
} from "@/components/app/location-selector";
import { navLinksForRole, secondaryLinks } from "@/components/app/nav-links";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileMenuOpen]);

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
              href={withLocation(link.href)}
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
          <div className="hidden text-sm text-muted-foreground xl:block">
            Welkom, <span className="font-medium text-foreground">{fullName}</span>
          </div>
          {role === "organization" && locations.length > 0 ? (
            <LocationSelector
              locations={locations}
              onChange={updateLocation}
              value={locationId}
            />
          ) : null}
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

        <main className="flex-1 pb-24 lg:pb-8">
          {hasPendingReview ? (
            <div className="border-b border-warning/30 bg-warning/10 px-4 py-3">
              <div className="mx-auto flex max-w-7xl flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-2 font-medium">
                  <Star className="h-4 w-4 text-warning" />
                  Je hebt nog een beoordeling openstaan
                </p>
                <Link
                  className="font-semibold text-primary hover:underline"
                  href={role === "organization" ? "/organisatie/reviews" : "/reviews"}
                >
                  Beoordeling afronden
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
              className="absolute inset-0 bg-foreground/30"
              onClick={() => setMobileMenuOpen(false)}
              type="button"
            />
            <section
              aria-label="Meer navigatie"
              className="absolute inset-x-0 bottom-[4.25rem] max-h-[72vh] overflow-y-auto rounded-t-2xl border-t border-border bg-card p-4 shadow-2xl"
            >
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold">Meer</p>
                  <p className="text-xs text-muted-foreground">
                    Alle overige onderdelen van SportMatch
                  </p>
                </div>
                <button
                  aria-label="Sluit menu"
                  className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                  type="button"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="grid gap-1" aria-label="Overige hoofdnavigatie">
                {mobileMoreLinks.map((link) => (
                  <Link
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                      isActive(link.href)
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted",
                    )}
                    href={withLocation(link.href)}
                    key={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <link.icon className="h-5 w-5 text-muted-foreground" />
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="my-3 h-px bg-border" />

              <nav className="grid gap-1" aria-label="Accountnavigatie">
                {secondaryLinks.map((link) => (
                  <Link
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                      isActive(link.href)
                        ? "bg-primary/10 text-primary"
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
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
        <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t border-border bg-card lg:hidden">
          {mobilePrimaryLinks.map((link) => (
            <Link
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.65rem] font-medium",
                isActive(link.href) ? "text-primary" : "text-muted-foreground",
              )}
              href={withLocation(link.href)}
              key={link.href}
            >
              <link.icon className="h-5 w-5" />
              {link.label}
            </Link>
          ))}
          <button
            aria-expanded={mobileMenuOpen}
            aria-label="Meer navigatie"
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.65rem] font-medium",
              mobileMoreActive || mobileMenuOpen
                ? "text-primary"
                : "text-muted-foreground",
            )}
            onClick={() => setMobileMenuOpen((open) => !open)}
            type="button"
          >
            <Menu className="h-5 w-5" />
            Meer
          </button>
        </nav>
      </div>
    </div>
  );
}
