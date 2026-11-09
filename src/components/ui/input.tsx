import * as React from "react";
import { cn } from "@/lib/utils";

/** Gedeelde basisstijl voor tekstvelden, selects en textareas. */
const fieldClassName =
  "w-full rounded-md border border-input bg-card px-3 text-sm text-foreground shadow-xs transition-[border-color,box-shadow] placeholder:text-muted-foreground/80 hover:border-border-strong focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-destructive/15";

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    className={cn(
      fieldClassName,
      "flex h-10 py-2 file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-medium",
      className,
    )}
    ref={ref}
    type={type}
    {...props}
  />
));
Input.displayName = "Input";

export { fieldClassName, Input };
