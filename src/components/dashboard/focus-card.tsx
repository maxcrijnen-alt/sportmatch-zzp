import { cn } from "@/lib/utils";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/** De belangrijkste eerstvolgende actie, bovenaan het dashboard. */
function FocusCard({
  title,
  text,
  href,
  cta,
  secondary,
}: {
  title: string;
  text: string;
  href: string;
  cta: string;
  secondary?: React.ReactNode;
}) {
  return (
    <section
      aria-label="Wat vraagt aandacht?"
      className="relative overflow-hidden rounded-xl border border-primary/20 bg-card shadow-card"
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-primary" />
      <div className="flex flex-col gap-3 p-4 pl-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5 sm:pl-6">
        <div className="flex min-w-0 items-center gap-4">
          <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary sm:flex">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Wat vraagt aandacht?
            </p>
            <h2 className="mt-0.5 text-base font-semibold tracking-tight sm:text-lg">{title}</h2>
            <p className="mt-0.5 line-clamp-2 max-w-2xl text-[13px] leading-5 text-muted-foreground sm:text-sm">
              {text}
            </p>
          </div>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
          {secondary}
          <Link
            href={href}
            className={cn(buttonVariants(), "w-full sm:w-auto")}
          >
            {cta}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export { FocusCard };
