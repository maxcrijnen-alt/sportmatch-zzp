import { cn } from "@/lib/utils";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { ReviewSort } from "@/lib/reviews/filter";

function ReviewFilters({
  stars,
  sort,
  resetHref,
  hiddenParams = {},
}: {
  stars: number | null;
  sort: ReviewSort;
  resetHref: string;
  hiddenParams?: Record<string, string | undefined>;
}) {
  return (
    <form
      className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end"
      method="get"
    >
      {Object.entries(hiddenParams).map(([name, value]) =>
        value ? <input key={name} name={name} type="hidden" value={value} /> : null,
      )}

      <label className="space-y-1 text-[11px] font-medium text-muted-foreground sm:w-40">
        Sterren
        <Select className="h-9 sm:h-8" defaultValue={stars?.toString() ?? ""} name="stars">
          <option value="">Alle sterren</option>
          <option value="5">5 sterren</option>
          <option value="4">4 sterren</option>
          <option value="3">3 sterren</option>
          <option value="2">2 sterren</option>
          <option value="1">1 ster</option>
        </Select>
      </label>

      <label className="space-y-1 text-[11px] font-medium text-muted-foreground sm:w-40">
        Sorteren
        <Select className="h-9 sm:h-8" defaultValue={sort} name="sort">
          <option value="recent">Meest recent</option>
          <option value="oldest">Oudste</option>
          <option value="highest">Hoogste score</option>
          <option value="lowest">Laagste score</option>
        </Select>
      </label>

      <Button className="w-full sm:w-auto" size="sm" type="submit">
        Toepassen
      </Button>

      <Link
        href={resetHref}
        className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "w-full sm:w-auto", "w-full")}
      >
        Reset
      </Link>
    </form>
  );
}

export { ReviewFilters };
