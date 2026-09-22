import Link from "next/link";
import { ArrowRight, CheckCircle2, ListTodo } from "lucide-react";

export interface DashboardTodoItem {
  title: string;
  description: string;
  href: string;
}

function DashboardTodoList({ items }: { items: DashboardTodoItem[] }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <ListTodo className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">To do</h2>
        </div>
        <span className="text-sm font-medium text-muted-foreground">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-3 px-5 py-4">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <p className="text-sm text-muted-foreground">
            Alles is bijgewerkt.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {items.map((item) => (
            <Link
              className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/50"
              href={item.href}
              key={item.title}
            >
              <div className="min-w-0">
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  {item.description}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export { DashboardTodoList };
