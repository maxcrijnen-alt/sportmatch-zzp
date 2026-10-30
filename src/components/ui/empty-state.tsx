import * as React from "react";
import { cn } from "@/lib/utils";

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center px-6 py-12 text-center",
        className,
      )}
    >
      {Icon ? (
        <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-subtle text-muted-foreground">
          <Icon className="h-5 w-5" />
        </span>
      ) : null}
      <p className="font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-md text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? (
        <div className="mt-5 flex w-full flex-col justify-center gap-2 sm:w-auto sm:flex-row">
          {action}
        </div>
      ) : null}
    </div>
  );
}

export { EmptyState };
