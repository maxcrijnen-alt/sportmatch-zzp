import type { LucideIcon } from "lucide-react";

/** Kerngegevens van een opdracht als rustige, uitgelijnde strip. */
function JobFacts({
  items,
}: {
  items: { icon: LucideIcon; label: string; value: React.ReactNode }[];
}) {
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-card shadow-card lg:grid-cols-4">
      {items.map((item, index) => (
        <div
          className={[
            "flex min-w-0 items-start gap-3 p-4",
            index % 2 === 1 ? "border-l border-border" : "",
            index >= 2 ? "border-t border-border lg:border-t-0" : "",
            index === 2 ? "lg:border-l" : "",
          ].join(" ")}
          key={item.label}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <item.icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className="mt-0.5 text-sm font-medium leading-5 text-foreground">
              {item.value}
            </dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

export { JobFacts };
