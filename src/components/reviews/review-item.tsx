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
    <article className={cn("px-4 py-4 sm:px-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <Stars rating={rating} />
            <span className="text-sm font-semibold tabular-nums">{rating}.0</span>
            <span className="text-xs text-muted-foreground">{date}</span>
          </div>
          {subtitle ? (
            <p className="mt-1 truncate text-[13px] text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      {comment ? (
        <p className="mt-2 text-sm leading-6 text-foreground/90">“{comment}”</p>
      ) : null}
    </article>
  );
}

export { ReviewItem };
