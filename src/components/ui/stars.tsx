import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Alleen-lezen sterrenweergave; afgerond op hele sterren. */
function Stars({
  rating,
  size = "sm",
  className,
}: {
  rating: number;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const rounded = Math.max(0, Math.min(5, Math.round(rating)));
  const sizeClass = size === "xs" ? "h-3 w-3" : size === "md" ? "h-5 w-5" : "h-3.5 w-3.5";

  return (
    <span
      aria-label={`${rounded} van 5 sterren`}
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          aria-hidden="true"
          className={cn(
            sizeClass,
            index < rounded
              ? "fill-amber-400 text-amber-400"
              : "fill-muted text-border-strong",
          )}
          key={index}
        />
      ))}
    </span>
  );
}

export { Stars };
