import Link from "next/link";
import { CheckCircle2, ChevronRight, ListTodo } from "lucide-react";
import { Panel, PanelHeader, PanelList } from "@/components/ui/page";

export interface DashboardTodoItem {
  title: string;
  description: string;
  href: string;
}

function DashboardTodoList({ items }: { items: DashboardTodoItem[] }) {
  return (
    <Panel>
      <PanelHeader
        count={items.length}
        icon={ListTodo}
        iconClassName="bg-primary-soft text-primary"
        title="To do"
      />

      {items.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-4 sm:px-5">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <p className="text-sm text-muted-foreground">Alles is bijgewerkt.</p>
        </div>
      ) : (
        <PanelList>
          {items.map((item, index) => (
            <Link
              className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-none sm:px-5"
              href={item.href}
              key={item.title}
            >
              <span
                aria-hidden="true"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border-strong bg-card text-[11px] font-semibold tabular-nums text-muted-foreground"
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-5">{item.title}</p>
                <p className="text-[13px] leading-5 text-muted-foreground">
                  {item.description}
                </p>
              </div>
              <span className="hidden h-8 shrink-0 items-center gap-1 rounded-md border border-border bg-card px-3 text-[13px] font-medium text-foreground shadow-xs transition-colors group-hover:border-primary/30 group-hover:text-primary sm:inline-flex">
                Openen
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground sm:hidden" />
            </Link>
          ))}
        </PanelList>
      )}
    </Panel>
  );
}

export { DashboardTodoList };
