"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface ActiveNavLinkProps {
  href: string;
  label: string;
  mobile?: boolean;
}

export function ActiveNavLink({ href, label, mobile }: ActiveNavLinkProps) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        mobile
          ? "rounded-md px-3 py-2 text-sm hover:bg-muted"
          : "transition-colors hover:text-foreground",
        active && "font-bold text-foreground",
        active && mobile && "bg-muted",
      )}
      href={href}
    >
      {label}
    </Link>
  );
}
