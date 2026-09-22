import Link from "next/link";
import { Button } from "@/components/ui/button";
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
      className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] sm:items-end"
      method="get"
    >
      {Object.entries(hiddenParams).map(([name, value]) =>
        value ? <input key={name} name={name} type="hidden" value={value} /> : null,
      )}

      <label className="space-y-1 text-[11px] font-medium text-muted-foreground">
        Sterren
        <Select defaultValue={stars?.toString() ?? ""} name="stars">
          <option value="">Alle sterren</option>
          <option value="5">5 sterren</option>
          <option value="4">4 sterren</option>
          <option value="3">3 sterren</option>
          <option value="2">2 sterren</option>
          <option value="1">1 ster</option>
        </Select>
      </label>

      <label className="space-y-1 text-[11px] font-medium text-muted-foreground">
        Sorteren
        <Select defaultValue={sort} name="sort">
          <option value="recent">Meest recent</option>
          <option value="oldest">Oudste</option>
          <option value="highest">Hoogste score</option>
          <option value="lowest">Laagste score</option>
        </Select>
      </label>

      <Button className="w-full sm:w-auto" size="sm" type="submit">
        Toepassen
      </Button>

      <Link className="w-full sm:w-auto" href={resetHref}>
        <Button className="w-full" size="sm" type="button" variant="outline">
          Reset
        </Button>
      </Link>
    </form>
  );
}

export { ReviewFilters };
