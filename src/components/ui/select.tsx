import * as React from "react";
import { fieldClassName } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Native select met consistente SportMatch-styling. */
const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    className={cn(fieldClassName, "sm-select flex h-10 py-2 pr-9", className)}
    ref={ref}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

export { Select };
