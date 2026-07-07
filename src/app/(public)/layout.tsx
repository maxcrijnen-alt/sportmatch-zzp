import Link from "next/link";
import { Menu } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/branding";

const navItems = [
  { href: "/hoe-het-werkt", label: "Hoe het werkt" },
  { href: "/voor-instructeurs", label: "Voor instructeurs" },
  { href: "/voor-sportscholen", label: "Voor sportscholen" },
  { href: "/tarieven", label: "Tarieven" },
  { href: "/demo", label: "Demo" },
  { href: "/faq", label: "FAQ" },
];

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4">
          <Link aria-label={`${BRAND.name} home`} href="/">
            <Logo />
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-muted-foreground lg:flex">
            {navItems.map((item) => (
              <Link
                className="transition-colors hover:text-foreground"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Link href="/demo">
              <Button variant="outline">Demo bekijken</Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost">Inloggen</Button>
            </Link>
            <Link href="/registreren">
              <Button>Gratis starten</Button>
            </Link>
          </div>

          {/* Mobiel menu zonder JavaScript: details/summary */}
          <details className="relative lg:hidden">
            <summary
              aria-label="Menu openen"
              className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-md hover:bg-muted [&::-webkit-details-marker]:hidden"
            >
              <Menu className="h-5 w-5" />
            </summary>
            <div className="absolute right-0 top-12 z-50 flex w-56 flex-col gap-1 rounded-lg border border-border bg-card p-2 shadow-lg">
              {navItems.map((item) => (
                <Link
                  className="rounded-md px-3 py-2 text-sm hover:bg-muted"
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              ))}
              <div className="my-1 h-px bg-border" />
              <Link className="rounded-md px-3 py-2 text-sm hover:bg-muted" href="/login">
                Inloggen
              </Link>
              <Link
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                href="/registreren"
              >
                Gratis starten
              </Link>
            </div>
          </details>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-muted/40">
        <div className="mx-auto w-full max-w-6xl px-4 py-10">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-3">
              <Logo />
              <p className="text-sm text-muted-foreground">{BRAND.description}</p>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold">Platform</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link className="hover:text-foreground" href="/hoe-het-werkt">Hoe het werkt</Link></li>
                <li><Link className="hover:text-foreground" href="/voor-instructeurs">Voor instructeurs</Link></li>
                <li><Link className="hover:text-foreground" href="/voor-sportscholen">Voor sportscholen</Link></li>
                <li><Link className="hover:text-foreground" href="/tarieven">Tarieven</Link></li>
                <li><Link className="hover:text-foreground" href="/demo">Demo bekijken</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold">Juridisch</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link className="hover:text-foreground" href="/voorwaarden">Algemene voorwaarden</Link></li>
                <li><Link className="hover:text-foreground" href="/privacy">Privacybeleid</Link></li>
                <li><Link className="hover:text-foreground" href="/faq">Veelgestelde vragen</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold">Belangrijk om te weten</h3>
              <p className="text-sm text-muted-foreground">
                {BRAND.name} faciliteert matching en communicatie. Wij geven geen
                juridisch of fiscaal advies. Gebruikers blijven zelf
                verantwoordelijk voor contracten, belastingen, verzekeringen en
                naleving van wet- en regelgeving.
              </p>
            </div>
          </div>
          <div className="mt-8 border-t border-border pt-6 text-xs text-muted-foreground">
            © {new Date().getFullYear()} {BRAND.name}. Betaling voor opdrachten
            verloopt rechtstreeks tussen organisatie en instructeur, buiten het
            platform om.
          </div>
        </div>
      </footer>
    </div>
  );
}
