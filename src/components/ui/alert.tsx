import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm leading-6 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-3.5 [&>svg]:h-4 [&>svg]:w-4 [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "border-border bg-card text-foreground [&>svg]:text-muted-foreground",
        info: "border-primary/20 bg-primary-soft text-foreground [&>svg]:text-primary",
        warning: "border-warning/25 bg-warning-soft text-foreground [&>svg]:text-warning",
        destructive:
          "border-destructive/20 bg-destructive-soft text-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

function Alert({ className, variant, ...props }: AlertProps) {
  return (
    <div
      className={cn(alertVariants({ variant }), className)}
      role="alert"
      {...props}
    />
  );
}

function AlertTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h5
      className={cn("mb-0.5 font-semibold leading-6", className)}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("text-sm leading-6 opacity-90", className)}
      {...props}
    />
  );
}

export { Alert, AlertDescription, AlertTitle };
