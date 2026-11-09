import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium leading-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-primary/15 bg-primary-soft text-primary-soft-foreground",
        secondary: "border-slate-200 bg-slate-100 text-slate-700",
        accent: "border-lime-200 bg-accent text-accent-foreground",
        muted: "border-transparent bg-muted text-muted-foreground",
        outline: "border-border bg-card text-foreground",
        destructive:
          "border-destructive/15 bg-destructive-soft text-destructive",
        warning: "border-warning/20 bg-warning-soft text-amber-700",
        success: "border-success/15 bg-success-soft text-primary-soft-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

/** Compact getal naast een sectietitel of tab. */
function CountBadge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-muted px-1.5 text-xs font-semibold tabular-nums text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Badge, badgeVariants, CountBadge };
