import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils";

const toneClasses = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary-soft text-primary",
  warning: "bg-warning-soft text-warning",
  danger: "bg-destructive-soft text-destructive",
};

/** Compacte KPI-tegel; klikbaar wanneer er een href is. */
function StatTile({
  label,
  value,
  href,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: keyof typeof toneClasses;
  className?: string;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium leading-4 text-muted-foreground sm:text-[13px]">
          {label}
        </p>
        {Icon ? (
          <span
            className={cn(
              "hidden h-7 w-7 shrink-0 items-center justify-center rounded-md sm:flex",
              toneClasses[tone],
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-xl font-semibold leading-none tracking-tight tabular-nums sm:text-[1.75rem]">
        {value}
      </p>
    </>
  );

  const baseClassName = cn(
    "flex flex-col justify-between rounded-xl border border-border bg-card p-3 shadow-card sm:p-4",
    className,
  );

  if (!href) {
    return <div className={baseClassName}>{content}</div>;
  }

  return (
    <Link
      className={cn(
        baseClassName,
        "transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
      )}
      href={href}
    >
      {content}
    </Link>
  );
}

export { StatTile };
