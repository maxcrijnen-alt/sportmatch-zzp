import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Vorige/volgende-paginering met paginanummer; links behouden de filters. */
export function CandidatePagination({
  page,
  pageCount,
  hrefForPage,
  label = "Paginering kandidaten",
}: {
  page: number;
  pageCount: number;
  hrefForPage: (page: number) => string;
  label?: string;
}) {
  if (pageCount <= 1) return null;

  const previous = page > 1 ? hrefForPage(page - 1) : null;
  const next = page < pageCount ? hrefForPage(page + 1) : null;
  const linkClass = cn(buttonVariants({ size: "sm", variant: "outline" }), "min-w-28");
  const disabledClass = cn(linkClass, "pointer-events-none opacity-50");

  return (
    <nav
      aria-label={label}
      className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5"
    >
      {previous ? (
        <Link className={linkClass} href={previous} rel="prev">
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          Vorige
        </Link>
      ) : (
        <span aria-disabled="true" className={disabledClass}>
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          Vorige
        </span>
      )}
      <p aria-current="page" className="text-[13px] text-muted-foreground">
        Pagina <span className="font-semibold text-foreground">{page}</span> van {pageCount}
      </p>
      {next ? (
        <Link className={linkClass} href={next} rel="next">
          Volgende
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      ) : (
        <span aria-disabled="true" className={disabledClass}>
          Volgende
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </span>
      )}
    </nav>
  );
}
