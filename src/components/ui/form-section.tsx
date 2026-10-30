import * as React from "react";
import { cn } from "@/lib/utils";

/** Visuele groep binnen een formulier, gescheiden door een dunne lijn. */
function FormSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <fieldset
      className={cn(
        "space-y-3 border-t border-border pt-5 first:border-t-0 first:pt-0",
        className,
      )}
    >
      <legend className="float-left mb-3 w-full text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </legend>
      <div className="clear-both space-y-3">{children}</div>
    </fieldset>
  );
}

/** Keuzechip voor checkbox-groepen (sporten, lesvormen, statussen). */
const choiceChipClassName =
  "inline-flex cursor-pointer items-center rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground shadow-xs transition-colors hover:border-border-strong hover:text-foreground has-checked:border-primary/40 has-checked:bg-primary-soft has-checked:font-medium has-checked:text-primary-soft-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring/40";

export { choiceChipClassName, FormSection };
