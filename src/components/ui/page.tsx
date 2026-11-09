import Link from "next/link";
import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { CountBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const pageWidths = {
  narrow: "max-w-3xl",
  medium: "max-w-4xl",
  default: "max-w-6xl",
  wide: "max-w-7xl",
};

/** Vaste paginacontainer: één breedte- en spacingschaal voor de hele app. */
function Page({
  className,
  width = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { width?: keyof typeof pageWidths }) {
  return (
    <div
      className={cn(
        "mx-auto w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8",
        pageWidths[width],
        className,
      )}
      {...props}
    />
  );
}

function PageHeader({
  title,
  description,
  actions,
  back,
  meta,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("space-y-3", className)}>
      {back ? (
        <Link
          className="inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          href={back.href}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          {meta ? <div className="flex flex-wrap items-center gap-1.5">{meta}</div> : null}
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem] sm:leading-9">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 [&>*]:max-sm:flex-1">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}

/** Kop boven een groep content die niet in een kaart staat. */
function SectionHeading({
  title,
  count,
  actions,
  description,
  className,
  as: Heading = "h2",
}: {
  title: React.ReactNode;
  count?: number;
  actions?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  as?: "h2" | "h3";
}) {
  return (
    <div className={cn("flex items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Heading className="text-base font-semibold tracking-tight">{title}</Heading>
          {count != null ? <CountBadge>{count}</CountBadge> : null}
        </div>
        {description ? (
          <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Kaart met kop en lijst-inhoud; de basis voor overzichten. */
const Panel = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>(({ className, ...props }, ref) => (
  <section
    className={cn(
      "overflow-hidden rounded-xl border border-border bg-card shadow-card",
      className,
    )}
    ref={ref}
    {...props}
  />
));
Panel.displayName = "Panel";

function PanelHeader({
  title,
  icon: Icon,
  iconClassName,
  count,
  description,
  actions,
  className,
  as: Heading = "h2",
}: {
  title: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
  count?: number;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  as?: "h2" | "h3";
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {Icon ? (
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground",
              iconClassName,
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
        <div className="min-w-0">
          <Heading className="text-[15px] font-semibold leading-6 tracking-tight">
            {title}
          </Heading>
          {description ? (
            <p className="text-xs leading-5 text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        {count != null ? <CountBadge>{count}</CountBadge> : null}
      </div>
    </div>
  );
}

/** Lijst met dunne scheidingslijnen tussen rijen. */
function PanelList({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("divide-y divide-border", className)} {...props} />;
}

function PanelEmpty({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("px-4 py-6 text-sm text-muted-foreground sm:px-5", className)}
      {...props}
    />
  );
}

export {
  Page,
  PageHeader,
  Panel,
  PanelEmpty,
  PanelHeader,
  PanelList,
  SectionHeading,
};
