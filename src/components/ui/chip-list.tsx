"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Compacte lijst met labels. Toont de eerste `limit` items en zet de rest
 * achter een uitklapknop, zodat lange lijsten (lesvormen, sporten)
 * de pagina niet domineren maar wel volledig beschikbaar blijven.
 */
function ChipList({
  items,
  limit = 8,
  variant = "outline",
  empty = "Niet ingevuld",
  className,
}: {
  items: { id: string; name: string }[];
  limit?: number;
  variant?: BadgeProps["variant"];
  empty?: string;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) {
    return <span className="text-sm text-muted-foreground">{empty}</span>;
  }

  const visible = expanded ? items : items.slice(0, limit);
  const hiddenCount = items.length - limit;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {visible.map((item) => (
        <Badge key={item.id} variant={variant}>
          {item.name}
        </Badge>
      ))}
      {hiddenCount > 0 ? (
        <button
          aria-expanded={expanded}
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-border-strong px-2 py-0.5 text-xs font-medium leading-5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          {expanded ? "Minder tonen" : `+${hiddenCount} meer`}
          <ChevronDown
            className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")}
          />
        </button>
      ) : null}
    </div>
  );
}

export { ChipList };
