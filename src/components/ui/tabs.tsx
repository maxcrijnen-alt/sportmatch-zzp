import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface TabLinkItem {
  href: string;
  label: React.ReactNode;
  active: boolean;
  count?: number;
  icon?: React.ComponentType<{ className?: string }>;
}

/** Segmented tabs op basis van links, zodat filters in de URL blijven. */
function TabLinks({
  items,
  label,
  className,
  fullWidth = false,
}: {
  items: TabLinkItem[];
  label: string;
  className?: string;
  fullWidth?: boolean;
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "flex max-w-full gap-1 overflow-x-auto rounded-lg border border-border bg-muted/70 p-1",
        fullWidth ? "w-full" : "w-fit",
        className,
      )}
    >
      {items.map((item) => (
        <Link
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "inline-flex min-h-8 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            fullWidth && "flex-1",
            item.active
              ? "bg-card text-foreground shadow-card ring-1 ring-black/5"
              : "text-muted-foreground hover:text-foreground",
          )}
          href={item.href}
          key={item.href}
        >
          {item.icon ? <item.icon className="h-3.5 w-3.5" /> : null}
          {item.label}
          {item.count != null ? (
            <span
              className={cn(
                "rounded px-1.5 text-[11px] font-semibold tabular-nums",
                item.active
                  ? "bg-primary-soft text-primary-soft-foreground"
                  : "bg-card/70 text-muted-foreground",
              )}
            >
              {item.count}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

export { TabLinks };
