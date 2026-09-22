import { Building2, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

type RoleIconRole = "organization" | "instructor";

const roleStyles: Record<
  RoleIconRole,
  {
    icon: typeof Building2;
    className: string;
  }
> = {
  organization: {
    icon: Building2,
    className:
      "bg-emerald-500/10 text-emerald-600 ring-1 ring-inset ring-emerald-600/15",
  },
  instructor: {
    icon: Dumbbell,
    className: "bg-red-500/10 text-red-600 ring-1 ring-inset ring-red-600/15",
  },
};

function RoleIcon({
  role,
  className,
  iconClassName,
}: {
  role: RoleIconRole;
  className?: string;
  iconClassName?: string;
}) {
  const { icon: Icon, className: roleClassName } = roleStyles[role];

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
        roleClassName,
        className,
      )}
    >
      <Icon className={cn("h-5 w-5", iconClassName)} />
    </span>
  );
}

export { RoleIcon };
export type { RoleIconRole };
