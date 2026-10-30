import Image from "next/image";
import { cn } from "@/lib/utils";

type RoleIconRole = "organization" | "instructor";

/*
 * Beide rolicons zijn uitsneden uit hetzelfde vector-beeldmerk: dezelfde
 * schaal, lijndikte en kaderverhouding, in de groen/rood-kleuren van het logo.
 */
const roleStyles: Record<RoleIconRole, { src: string; className: string }> = {
  organization: {
    src: "/sportmatch-role-organization.svg",
    className: "bg-brand-green/[0.07] ring-brand-green/15",
  },
  instructor: {
    src: "/sportmatch-role-instructor.svg",
    className: "bg-brand-red/[0.06] ring-brand-red/15",
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
  const roleStyle = roleStyles[role];

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
        roleStyle.className,
        className,
      )}
    >
      <span
        className={cn(
          "relative inline-flex h-6 w-6 items-center justify-center",
          iconClassName,
        )}
      >
        <Image
          alt=""
          aria-hidden="true"
          className="h-full w-full object-contain"
          fill
          sizes="48px"
          src={roleStyle.src}
        />
      </span>
    </span>
  );
}

export { RoleIcon };
export type { RoleIconRole };
