import { cn } from "@/lib/utils";
import Link from "next/link";
import { Star } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Panel, PanelHeader, PanelList } from "@/components/ui/page";

/** Openstaande, verplichte beoordelingen met directe actie. */
function PendingReviews({
  description,
  items,
}: {
  description: string;
  items: { id: string; title: string; href: string }[];
}) {
  return (
    <Panel className="border-warning/30">
      <PanelHeader
        className="bg-warning-soft"
        count={items.length}
        description={description}
        icon={Star}
        iconClassName="bg-card text-warning"
        title="Openstaande beoordeling"
      />
      <PanelList>
        {items.map((item) => (
          <div
            className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
            key={item.id}
          >
            <span className="min-w-0 truncate text-sm font-medium">{item.title}</span>
            <Link
              href={item.href}
              className={cn(buttonVariants({ size: "sm" }), "shrink-0")}
            >Nu beoordelen</Link>
          </div>
        ))}
      </PanelList>
    </Panel>
  );
}

export { PendingReviews };
