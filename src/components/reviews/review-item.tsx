import { Stars } from "@/components/ui/stars";
import { cn } from "@/lib/utils";

/** Compacte reviewregel: sterren, context, datum en eventueel commentaar. */
function ReviewItem({
  rating,
  subtitle,
  date,
  comment,
  aside,
  className,
}: {
  rating: number;
  subtitle?: React.ReactNode;
  date: string;
  comment?: string | null;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={cn("px-4 py-3 sm:px-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Stars rating={rating} size="xs" />
            <span className="text-sm font-semibold tabular-nums">{rating}.0</span>
            {subtitle ? (
              <span className="min-w-0 truncate text-[13px] font-medium text-foreground/80">
                {subtitle}
              </span>
            ) : null}
            <span className="text-xs text-muted-foreground">{date}</span>
          </div>
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      {comment ? (
        <p className="mt-1 text-sm leading-6 text-foreground/90">“{comment}”</p>
      ) : null}
    </article>
  );
}

export { ReviewItem };
